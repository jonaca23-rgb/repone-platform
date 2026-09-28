-- RepOne Platform — Athlete contact info (email, phone) + duplicate-record
-- prevention
--
-- Jonathan asked that the athlete portal not allow repeated records — the
-- same email or the same phone number shouldn't be able to create two
-- `athletes` rows in the same organization — and to add a phone field to
-- the athlete section. Neither field existed on `athletes` before this: a
-- login email lives only in `auth.users` (invisible to the roster, and only
-- exists at all for athletes who signed up themselves), and there was no
-- phone field anywhere. This adds both as contact info AND as the two
-- natural duplicate-detection keys, wired into every place an `athletes`
-- row gets created: the admin "Add Athlete" form, the self-service "Add New
-- Athlete" flow (0017_athlete_likes_and_roster_add.sql), and athlete
-- sign-up/onboarding (`bootstrap_athlete`).

alter table athletes
  add column email text,
  add column phone text;

-- Case-insensitive, organization-scoped uniqueness. A partial index only
-- ever indexes rows matching its predicate, so a blank/omitted value never
-- collides with another blank/omitted value — same as Postgres's normal
-- "NULLs are distinct" behavior for a plain unique column, just extended to
-- also treat '' as "not provided."
create unique index athletes_org_email_unique on athletes (organization_id, lower(btrim(email)))
  where email is not null and btrim(email) <> '';

-- Phone is normalized to digits-only before comparing, so "(787) 555-0134",
-- "787-555-0134", and "7875550134" are all treated as the same number.
create unique index athletes_org_phone_unique on athletes (organization_id, regexp_replace(phone, '\D', '', 'g'))
  where phone is not null and regexp_replace(phone, '\D', '', 'g') <> '';

-- Same column-lockdown convention as auth_user_id/date_of_birth
-- (0016_messaging.sql) — contact info is not broadcast-safe, and `athletes`
-- is still public-read for unauthenticated overlays (0002_rls_and_realtime.sql).
revoke select (email, phone) on table athletes from anon;

-- ---------------------------------------------------------------------------
-- bootstrap_athlete() gains p_email/p_phone. A changed parameter list is a
-- distinct function as far as Postgres is concerned — CREATE OR REPLACE
-- can't widen an existing signature in place — so the 5-argument version
-- from 0010_athlete_open_log.sql is dropped first.
-- ---------------------------------------------------------------------------

drop function if exists bootstrap_athlete(text, text, text, date, athlete_gender);

create or replace function bootstrap_athlete(
  p_first_name text,
  p_last_name text,
  p_affiliate text,
  p_date_of_birth date,
  p_gender athlete_gender,
  p_email text default null,
  p_phone text default null
) returns uuid as $$
declare
  v_org_id uuid;
  v_athlete_id uuid;
begin
  if exists (select 1 from athletes where auth_user_id = auth.uid()) then
    raise exception 'This account is already linked to an athlete profile';
  end if;

  select organization_id into v_org_id from profiles where organization_id is not null limit 1;
  if v_org_id is null then
    raise exception 'No RepOne organization has been set up yet';
  end if;

  insert into athletes (organization_id, first_name, last_name, affiliate, date_of_birth, gender, auth_user_id, email, phone)
  values (v_org_id, p_first_name, p_last_name, p_affiliate, p_date_of_birth, p_gender, auth.uid(), p_email, p_phone)
  returning id into v_athlete_id;

  return v_athlete_id;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function bootstrap_athlete(text, text, text, date, athlete_gender, text, text) to authenticated;
