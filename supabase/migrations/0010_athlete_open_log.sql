-- RepOne Platform — Athlete self-service accounts + RepOne Open Log
--
-- Jonathan asked for athletes to be able to log in themselves and submit
-- their own "CrossFit Open-style" results — any workout name they choose, in
-- whatever modality it was scored in (time/reps/weight/points) — building a
-- personal performance history inside RepOne Platform, not an official
-- CrossFit Games ranking. Per his explicit correction: NO worldwide/country/
-- region/affiliate/official-CrossFit ranking fields, and classification is
-- ONLY 'scaled' or 'open' (no Rx/elite/masters/etc at this stage). This
-- migration deliberately computes no cross-athlete ranking at all yet — it
-- only captures the data. A same-workout, RepOne-only leaderboard could be
-- built later on top of this table without a schema change.
--
-- ATHLETE ACCOUNTS ARE A NEW, SEPARATE IDENTITY SPACE from staff accounts.
-- Both use the same Supabase `auth.users` (so one login system), but an
-- athlete never gets a `profiles.organization_id` or a `user_roles` row —
-- they're linked to their `athletes` record instead, via the new
-- `athletes.auth_user_id` column. This means `getSessionContext()` (staff)
-- keeps working exactly as before for an athlete account: no profile
-- organization_id and no roles, so `/admin/*` still correctly bounces them
-- to /login. A new, separate `getAthleteSessionContext()` is what checks the
-- athlete side. See 0003_bootstrap.sql's `handle_new_user()` trigger, which
-- already creates a bare `profiles` row for every new auth user (staff or
-- athlete) automatically — nothing new needed there.

alter table athletes
  add column auth_user_id uuid unique references auth.users(id) on delete set null;

create type open_classification as enum ('scaled', 'open');
create type open_result_modality as enum ('time', 'reps', 'weight', 'points');

create table athlete_open_logs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  workout_name text not null, -- free text — any workout, not a fixed weekly list
  classification open_classification not null,
  modality open_result_modality not null,
  result_display text not null, -- free-form, matches the athlete_benchmarks convention: "8:32", "225 lbs", "212 reps", "150 pts"
  performed_on date, -- optional; no min/max — meant to cover past years and future ones alike
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on athlete_open_logs (athlete_id);

create trigger athlete_open_logs_set_updated_at before update on athlete_open_logs
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Self-signup bootstrap — the athlete-side counterpart to
-- bootstrap_organization() in 0003_bootstrap.sql. A signed-in user with no
-- linked athlete row yet can create exactly one for themselves. SECURITY
-- DEFINER because it needs to (a) insert into `athletes`, which normal RLS
-- restricts to org staff, and (b) resolve which organization to join.
--
-- Org resolution: this deployment is single-organization (see the
-- orphaned-org incident documented in supabase/fix_qa_circuit_org.sql — a
-- leftover, profile-less sample org from seed.sql once got picked by a
-- naive "earliest created_at" query). To avoid repeating that mistake, this
-- picks the organization referenced by any STAFF profile — an orphaned org
-- with no profile pointing at it can never be selected. If RepOne ever
-- becomes multi-organization, this function is the one place that needs a
-- real "which org is this athlete joining" input instead.
-- ---------------------------------------------------------------------------

create or replace function bootstrap_athlete(
  p_first_name text,
  p_last_name text,
  p_affiliate text,
  p_date_of_birth date,
  p_gender athlete_gender
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

  insert into athletes (organization_id, first_name, last_name, affiliate, date_of_birth, gender, auth_user_id)
  values (v_org_id, p_first_name, p_last_name, p_affiliate, p_date_of_birth, p_gender, auth.uid())
  returning id into v_athlete_id;

  return v_athlete_id;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function bootstrap_athlete(text, text, text, date, athlete_gender) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table athlete_open_logs enable row level security;

-- Not public-read (same call as athlete_lifts/athlete_benchmarks in
-- 0004_athlete_extras.sql) — self-reported personal history isn't
-- broadcast-facing. Readable by any org staff role, and by the athlete
-- themselves.
create policy "org staff read athlete_open_logs" on athlete_open_logs for select
  using (exists (select 1 from athletes a where a.id = athlete_open_logs.athlete_id
    and has_role(a.organization_id,
      array['admin','event_director','scoring_operator','production_director','commentator']::user_role[])));

create policy "athlete read own open logs" on athlete_open_logs for select
  using (exists (select 1 from athletes a where a.id = athlete_open_logs.athlete_id
    and a.auth_user_id = auth.uid()));

-- Staff can moderate/remove entries (e.g. a joke or duplicate submission);
-- the athlete manages their own.
create policy "org staff manage athlete_open_logs" on athlete_open_logs for all
  using (exists (select 1 from athletes a where a.id = athlete_open_logs.athlete_id
    and has_role(a.organization_id, array['admin','event_director']::user_role[])));

create policy "athlete manage own open logs" on athlete_open_logs for all
  using (exists (select 1 from athletes a where a.id = athlete_open_logs.athlete_id
    and a.auth_user_id = auth.uid()))
  with check (exists (select 1 from athletes a where a.id = athlete_open_logs.athlete_id
    and a.auth_user_id = auth.uid()));
