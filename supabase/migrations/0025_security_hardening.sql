-- ---------------------------------------------------------------------------
-- 0025 — Security hardening (docs/audit/2026-09-28-initial-audit.md)
--
-- Signup is open to anyone, so "authenticated" is effectively public too.
-- Everything below is proven by scripts/rls-check.ts (pnpm db:rls-check).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- C1. Athlete PII. 0016/0018 revoked single columns from anon, but Supabase
-- grants anon/authenticated a TABLE-level SELECT, which a column revoke does
-- not override — email/phone/date_of_birth stayed readable by anyone.
-- Now: the table grant goes, and only broadcast-safe columns are granted
-- back. Email, phone and date of birth are read through
-- athlete_private_details(), which checks who is asking.
-- ---------------------------------------------------------------------------

revoke select on table athletes from anon, authenticated;
grant select (id, organization_id, first_name, last_name, affiliate, gender, photo_url, created_at)
  on table athletes to anon, authenticated;
-- Signed-in users need auth_user_id to start a conversation (messaging).
grant select (auth_user_id) on table athletes to authenticated;

-- Is the caller staff in this org through an event-scoped assignment?
-- (Scorekeepers/producers/commentators may have no user_roles row at all.)
create or replace function is_org_event_staff(p_organization_id uuid) returns boolean as $$
  select exists (
    select 1 from events e
    where e.organization_id = p_organization_id
      and (is_event_scorekeeper(e.id) or is_event_producer(e.id) or is_event_commentator(e.id))
  );
$$ language sql stable security definer set search_path = public;

create or replace function athlete_private_details(p_athlete_ids uuid[])
returns table (id uuid, email text, phone text, date_of_birth date) as $$
  select a.id, a.email, a.phone, a.date_of_birth
  from athletes a
  where a.id = any(p_athlete_ids)
    and (
      a.auth_user_id = (select auth.uid())
      or has_role(a.organization_id, enum_range(null::user_role))
      or is_org_event_staff(a.organization_id)
    );
$$ language sql stable security definer set search_path = public;

revoke execute on function is_org_event_staff(uuid) from public, anon;
revoke execute on function athlete_private_details(uuid[]) from public, anon;
grant execute on function is_org_event_staff(uuid) to authenticated;
grant execute on function athlete_private_details(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- H1. bootstrap_organization let ANY account without an org (every athlete)
-- create an org and become its admin. The platform is single-organization
-- (bootstrap_athlete joins "the" org), so creating one is now only allowed
-- while none exists: the first-run setup screen.
-- ---------------------------------------------------------------------------

create or replace function bootstrap_organization(p_name text) returns uuid as $$
declare
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  -- Serialize concurrent first-run attempts so only one org can ever win.
  lock table organizations in exclusive mode;
  if exists (select 1 from organizations) then
    raise exception 'An organization already exists; ask its admin for access';
  end if;

  insert into organizations (name) values (p_name) returning id into v_org_id;
  update profiles set organization_id = v_org_id where id = auth.uid();
  insert into user_roles (user_id, organization_id, role) values (auth.uid(), v_org_id, 'admin');
  return v_org_id;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function bootstrap_organization(text) from public, anon;
grant execute on function bootstrap_organization(text) to authenticated;

-- ---------------------------------------------------------------------------
-- H2. bootstrap_athlete picked the org with `limit 1` and no ORDER BY. With a
-- single org (H1) that is now deterministic; ordering by age makes it so even
-- if a second org is ever created by hand.
-- ---------------------------------------------------------------------------

create or replace function bootstrap_athlete(
  p_first_name text,
  p_last_name text,
  p_affiliate text,
  p_date_of_birth date,
  p_gender athlete_gender,
  p_email text,
  p_phone text default null
) returns uuid as $$
declare
  v_org_id uuid;
  v_athlete_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if exists (select 1 from athletes where auth_user_id = auth.uid()) then
    raise exception 'This account is already linked to an athlete profile';
  end if;

  if p_email is null or btrim(p_email) = '' then
    raise exception 'Email is required';
  end if;

  select id into v_org_id from organizations order by created_at, id limit 1;
  if v_org_id is null then
    raise exception 'No RepOne organization has been set up yet';
  end if;

  insert into athletes (organization_id, first_name, last_name, affiliate, date_of_birth, gender, auth_user_id, email, phone)
  values (v_org_id, p_first_name, p_last_name, p_affiliate, p_date_of_birth, p_gender, auth.uid(), p_email, p_phone)
  returning id into v_athlete_id;

  return v_athlete_id;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function bootstrap_athlete(text, text, text, date, athlete_gender, text, text) from public, anon;
grant execute on function bootstrap_athlete(text, text, text, date, athlete_gender, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- H3. Storage. Any signed-in user could upload/overwrite/delete any object in
-- both public buckets (including images on the broadcast). Writes are now
-- scoped by the object's first folder, which the app already sets to the
-- athlete id / event id. Buckets also enforce size and image types, instead
-- of trusting the client-supplied file.type.
-- ---------------------------------------------------------------------------

create or replace function can_manage_athlete_photo(p_object_name text) returns boolean as $$
  select exists (
    select 1 from athletes a
    where a.id::text = (storage.foldername(p_object_name))[1]
      and (
        has_role(a.organization_id, array['admin','event_director']::user_role[])
        or a.auth_user_id = (select auth.uid())
      )
  );
$$ language sql stable security definer set search_path = public;

create or replace function can_manage_event_photo(p_object_name text) returns boolean as $$
  select exists (
    select 1 from events e
    where e.id::text = (storage.foldername(p_object_name))[1]
      and (
        has_role(e.organization_id, array['admin','event_director']::user_role[])
        or is_event_producer(e.id)
      )
  );
$$ language sql stable security definer set search_path = public;

revoke execute on function can_manage_athlete_photo(text) from public, anon;
revoke execute on function can_manage_event_photo(text) from public, anon;
grant execute on function can_manage_athlete_photo(text) to authenticated;
grant execute on function can_manage_event_photo(text) to authenticated;

drop policy if exists "authenticated manage athlete_photos" on storage.objects;
create policy "manage own or org athlete_photos" on storage.objects for all to authenticated
  using (bucket_id = 'athlete-photos' and can_manage_athlete_photo(name))
  with check (bucket_id = 'athlete-photos' and can_manage_athlete_photo(name));

drop policy if exists "authenticated manage event_photos" on storage.objects;
create policy "manage org event_photos" on storage.objects for all to authenticated
  using (bucket_id = 'event-photos' and can_manage_event_photo(name))
  with check (bucket_id = 'event-photos' and can_manage_event_photo(name));

update storage.buckets
set file_size_limit = 8 * 1024 * 1024,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
where id in ('athlete-photos', 'event-photos');

-- ---------------------------------------------------------------------------
-- M2. SECURITY DEFINER helpers without a pinned search_path can be hijacked
-- by objects created in a schema earlier on the caller's path.
-- ---------------------------------------------------------------------------

alter function has_role(uuid, user_role[], uuid) set search_path = public;
alter function set_updated_at() set search_path = public;
alter function prevent_cross_heat_duplicate_lane_assignment() set search_path = public;

-- ---------------------------------------------------------------------------
-- M4. Policy holes.
-- ---------------------------------------------------------------------------

-- An athlete adding a roster athlete could set auth_user_id to someone else's
-- account, hijacking that person's link (and blocking their onboarding).
drop policy if exists "athlete add org roster athlete" on athletes;
create policy "athlete add org roster athlete" on athletes for insert
  with check (
    auth_user_id is null
    and exists (
      select 1 from athletes a where a.auth_user_id = auth.uid() and a.organization_id = athletes.organization_id
    )
  );

-- A producer's "edit own event" policy covered every column, so a producer
-- could move the event to another organization or circuit. SECURITY INVOKER
-- on purpose: current_user must be the caller's role (authenticated), not the
-- function owner, for the service/migration exemption to mean anything.
create or replace function prevent_event_reparenting() returns trigger as $$
begin
  if (new.organization_id is distinct from old.organization_id
      or new.circuit_id is distinct from old.circuit_id)
     and not has_role(old.organization_id, array['admin','event_director']::user_role[])
     and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'Only an admin can change an event''s organization or circuit';
  end if;
  return new;
end;
$$ language plpgsql security invoker set search_path = public;

drop trigger if exists events_prevent_reparenting on events;
create trigger events_prevent_reparenting
  before update on events
  for each row execute function prevent_event_reparenting();

-- The recipient's "mark read" update policy covered every column, so the
-- recipient could rewrite the sender's message. Only read_at may change.
revoke update on table messages from anon, authenticated;
grant update (read_at) on table messages to authenticated;

-- operator_actions rows could be inserted with any user_id (forged audit log).
drop policy if exists "authenticated insert operator_actions" on operator_actions;
create policy "log own operator_actions" on operator_actions for insert to authenticated
  with check (user_id = auth.uid());
