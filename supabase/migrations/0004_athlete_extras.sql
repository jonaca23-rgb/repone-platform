-- RepOne Platform — Athlete profile extras
--  * date_of_birth + gender on athletes -> feeds a computed (not stored) age/gender
--    category: 35-44 Male, 35-44 Female, 45+ Male, 45+ Female (see
--    src/lib/scoring/ageCategory.ts — pure function, computed as of the event date)
--  * athlete_lifts: one current PR per named lift per athlete (lbs)
--  * athlete_benchmarks: one current result per named benchmark workout per athlete
--    (open-ended name, e.g. "Fran", "Karen", "Isabel", or any custom benchmark)

create type athlete_gender as enum ('male', 'female');

alter table athletes
  add column date_of_birth date,
  add column gender athlete_gender;

create type lift_name as enum (
  'deadlift',
  'bench_press',
  'strict_press',
  'back_squat',
  'front_squat',
  'clean',
  'squat_clean',
  'snatch',
  'power_snatch'
);

create table athlete_lifts (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  lift lift_name not null,
  weight_lbs numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (athlete_id, lift)
);

create table athlete_benchmarks (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  name text not null, -- e.g. "Fran" — open-ended, not a fixed list
  result_display text not null, -- e.g. "3:45" or "21 rounds + 4" — formats vary by benchmark
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (athlete_id, name)
);

create trigger athlete_lifts_set_updated_at before update on athlete_lifts
  for each row execute function set_updated_at();
create trigger athlete_benchmarks_set_updated_at before update on athlete_benchmarks
  for each row execute function set_updated_at();

-- RLS: this is athlete PR/benchmark data, not broadcast-facing, so — unlike the
-- public-read competition tables — reads require an org role too (any of the
-- 5 roles, so e.g. a commentator can reference it on-air); writes are
-- admin/event_director only, matching how the athletes table itself is managed.
alter table athlete_lifts enable row level security;
alter table athlete_benchmarks enable row level security;

create policy "org staff read athlete_lifts" on athlete_lifts for select
  using (exists (select 1 from athletes a where a.id = athlete_lifts.athlete_id
    and has_role(a.organization_id,
      array['admin','event_director','scoring_operator','production_director','commentator']::user_role[])));

create policy "org staff manage athlete_lifts" on athlete_lifts for all
  using (exists (select 1 from athletes a where a.id = athlete_lifts.athlete_id
    and has_role(a.organization_id, array['admin','event_director']::user_role[])));

create policy "org staff read athlete_benchmarks" on athlete_benchmarks for select
  using (exists (select 1 from athletes a where a.id = athlete_benchmarks.athlete_id
    and has_role(a.organization_id,
      array['admin','event_director','scoring_operator','production_director','commentator']::user_role[])));

create policy "org staff manage athlete_benchmarks" on athlete_benchmarks for all
  using (exists (select 1 from athletes a where a.id = athlete_benchmarks.athlete_id
    and has_role(a.organization_id, array['admin','event_director']::user_role[])));
