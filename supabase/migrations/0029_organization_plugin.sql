-- ---------------------------------------------------------------------------
-- 0029 — Org roles move to BetterAuth's organization plugin.
--
-- organizations becomes the plugin's `organization` model and `member` holds
-- each person's roles (comma-joined), defined in code with createAccessControl
-- (src/lib/auth/permissions.ts). has_role() keeps its signature and reads
-- member, so no policy that calls it changes. user_roles and
-- profiles.organization_id go away: membership is the member row.
-- Tables and columns mirror src/db/schema/auth.ts.
-- ---------------------------------------------------------------------------

-- The plugin's organization columns.
alter table organizations add column slug text, add column logo text, add column metadata text;
update organizations
  set slug = coalesce(nullif(trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')), ''), 'org')
             || '-' || left(id::text, 8);
alter table organizations alter column slug set not null;
alter table organizations add constraint organizations_slug_key unique (slug);

-- The admin plugin's user columns, and the plugins' session columns.
alter table public."user"
  add column role text,
  add column banned boolean default false,
  add column ban_reason text,
  add column ban_expires timestamptz;
alter table public.session
  add column active_organization_id uuid references organizations(id) on delete set null,
  add column impersonated_by uuid references public."user"(id) on delete set null;

create table public.member (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references public."user"(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now()
);
create unique index member_organization_user_idx on public.member (organization_id, user_id);
-- One owner per organization. Ownership is not transferable in the app yet:
-- moving it is a manual SQL step (demote the owner, then promote the new one).
create unique index member_one_owner_idx on public.member (organization_id)
  where role ~ '(^|,)\s*owner\s*(,|$)';
create index member_user_id_idx on public.member (user_id);

create table public.invitation (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role text,
  status text not null default 'pending',
  expires_at timestamptz not null,
  inviter_id uuid not null references public."user"(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index invitation_email_idx on public.invitation (email);

-- invitation: like the other auth tables, closed to the API.
alter table public.invitation enable row level security;
revoke all on public.invitation from anon, authenticated;

-- member: readable as user_roles was, never writable through the API
-- (BetterAuth writes it over the owner connection).
alter table public.member enable row level security;
revoke all on public.member from anon, authenticated;
grant select on public.member to authenticated;

-- ---------------------------------------------------------------------------
-- has_role reads member. Same signature, so every policy keeps working.
-- An owner counts wherever admin is asked for; p_event_id is ignored because
-- org roles are org-wide (event scope lives in the assignment tables).
-- ---------------------------------------------------------------------------
create or replace function has_role(
  p_organization_id uuid,
  p_roles user_role[],
  p_event_id uuid default null
) returns boolean as $$
  select exists (
    select 1 from public.member m
    where m.user_id = auth.uid()
      and m.organization_id = p_organization_id
      and string_to_array(replace(m.role, ' ', ''), ',')
          && (p_roles::text[] || case when 'admin' = any(p_roles::text[]) then array['owner'] else array[]::text[] end)
  );
$$ language sql stable security definer set search_path = public;

create policy "read own membership" on public.member for select using (user_id = auth.uid());
create policy "members read org members" on public.member for select
  using (has_role(organization_id, enum_range(null::user_role)));
create policy "athletes read org members" on public.member for select
  using (exists (select 1 from athletes a
                 where a.auth_user_id = auth.uid() and a.organization_id = member.organization_id));

-- The direct readers of user_roles move to member.
create or replace function can_message(p_sender uuid, p_recipient uuid) returns boolean as $$
  select p_sender <> p_recipient and (
    exists (
      select 1 from athletes s join athletes r on r.organization_id = s.organization_id
      where s.auth_user_id = p_sender and r.auth_user_id = p_recipient
    )
    or exists (
      select 1 from athletes s join public.member m on m.organization_id = s.organization_id
      where s.auth_user_id = p_sender and m.user_id = p_recipient
    )
    or exists (
      select 1 from athletes r join public.member m on m.organization_id = r.organization_id
      where r.auth_user_id = p_recipient and m.user_id = p_sender
    )
  );
$$ language sql stable security definer set search_path = public;

create or replace function can_like(p_liker uuid, p_athlete_id uuid) returns boolean as $$
  select exists (
    select 1 from athletes target
    where target.id = p_athlete_id
      and (
        exists (select 1 from athletes s where s.auth_user_id = p_liker and s.organization_id = target.organization_id)
        or exists (select 1 from public.member m where m.user_id = p_liker and m.organization_id = target.organization_id)
      )
  );
$$ language sql stable security definer set search_path = public;

drop policy if exists "athlete read org staff profiles" on profiles;
create policy "athlete read org staff profiles" on profiles for select
  using (exists (
    select 1 from athletes a join public.member m on m.organization_id = a.organization_id
    where a.auth_user_id = auth.uid() and m.user_id = profiles.id
  ));
-- Org members see each other's names (the Team page, staff lists).
create policy "members read org member profiles" on profiles for select
  using (exists (
    select 1 from public.member m
    where m.user_id = profiles.id and has_role(m.organization_id, enum_range(null::user_role))
  ));

-- Event directors manage event staff too (permission staff:invite).
do $$ declare t text; begin
  foreach t in array array['scorekeeper', 'producer', 'commentator'] loop
    execute format('drop policy if exists "admins manage %s assignments" on event_%s_assignments', t, t);
    execute format($p$create policy "managers manage %1$s assignments" on event_%1$s_assignments for all
      using (exists (select 1 from events e where e.id = event_%1$s_assignments.event_id
        and has_role(e.organization_id, array['admin','event_director']::user_role[])))
      with check (exists (select 1 from events e where e.id = event_%1$s_assignments.event_id
        and has_role(e.organization_id, array['admin','event_director']::user_role[])))$p$, t);
  end loop;
end $$;

-- First-run setup creates the org and makes the caller its owner.
create or replace function bootstrap_organization(p_name text) returns uuid as $$
declare
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  lock table organizations in exclusive mode;
  if exists (select 1 from organizations) then
    raise exception 'An organization already exists; ask its admin for access';
  end if;
  insert into organizations (name, slug)
    values (p_name, coalesce(nullif(trim(both '-' from regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g')), ''), 'org'))
    returning id into v_org_id;
  insert into public.member (organization_id, user_id, role) values (v_org_id, auth.uid(), 'owner');
  return v_org_id;
end;
$$ language plpgsql security definer set search_path = public;

-- Gone: membership is the member row.
drop table user_roles;
alter table profiles drop column organization_id;
