-- RepOne Platform — Every athlete must have an email on file
--
-- Jonathan asked that every registered athlete have an email, and confirmed
-- that an athlete's login is already their email — that part needed no
-- schema change, since athlete accounts have always been plain Supabase
-- Auth email/password logins (see src/app/(app)/athlete/actions.ts; there
-- has never been a separate "username" concept). This migration makes the
-- CONTACT email added in 0018_athlete_contact_info.sql mandatory at the
-- database level too, not just recommended in the app, so it holds no
-- matter which form (or a future one) creates the row.
--
-- Backfill first: any athlete added before 0018 introduced the email
-- column (or added afterward with it left blank) gets a clearly-fake
-- placeholder, unique per athlete id, so the NOT NULL/CHECK constraints
-- below can be added without failing on existing data. Find and fix any of
-- these in the admin athlete roster with:
--   select id, first_name, last_name, email from athletes where email like '%@repone.local';

update athletes
set email = 'no-email+' || id || '@repone.local'
where email is null or btrim(email) = '';

alter table athletes
  alter column email set not null,
  add constraint athletes_email_not_blank check (btrim(email) <> '');

-- ---------------------------------------------------------------------------
-- bootstrap_athlete()'s p_email loses its default — every self-signup must
-- supply one now (the app already passes the account's own login email).
-- The parameter types/order are unchanged from 0018, but Postgres still
-- refuses to REMOVE a default from an existing parameter via CREATE OR
-- REPLACE ("cannot remove parameter defaults from existing function") — it
-- only allows adding/changing trailing defaults, not taking one away. So
-- the function has to be dropped and recreated, same as when 0018 first
-- added these two parameters. A belt-and-suspenders check is added inside
-- the function too, so a stale/uncompiled client hitting the RPC directly
-- still gets a clear error instead of relying solely on the new table
-- constraint.
-- ---------------------------------------------------------------------------

drop function if exists bootstrap_athlete(text, text, text, date, athlete_gender, text, text);

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
  if exists (select 1 from athletes where auth_user_id = auth.uid()) then
    raise exception 'This account is already linked to an athlete profile';
  end if;

  if p_email is null or btrim(p_email) = '' then
    raise exception 'Email is required';
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
