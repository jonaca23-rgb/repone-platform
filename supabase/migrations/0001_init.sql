-- RepOne Platform — Phase 1 schema
-- Design principles enforced here:
--  * one source of truth: broadcast_state is the only table overlays read
--  * raw results are stored per scoring type, never as one generic "score"
--  * standings are always derived/rebuildable from results, never hand-edited
--  * multi-floor is structural from day one (venues -> floors -> heats/broadcast_state)

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Organizations & Users & Roles
-- ---------------------------------------------------------------------------

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Supabase auth.users already exists; we extend with a profile + role table.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references organizations(id) on delete set null,
  full_name text,
  created_at timestamptz not null default now()
);

create type user_role as enum (
  'admin',
  'event_director',
  'scoring_operator',
  'production_director',
  'commentator'
);

create table user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  event_id uuid, -- nullable: null = org-wide role, set = scoped to one event
  role user_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, organization_id, event_id, role)
);

-- ---------------------------------------------------------------------------
-- Events, Venues, Floors (multi-floor ready from day one)
-- ---------------------------------------------------------------------------

create type event_status as enum ('draft', 'scheduled', 'live', 'completed', 'archived');

create table events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  status event_status not null default 'draft',
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table venues (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  address text,
  created_at timestamptz not null default now()
);

-- A "Competition Floor / Platform". Cameras/production zones attach here later.
create table floors (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete cascade,
  name text not null, -- e.g. "Floor A"
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Reserved for future ISO/production-zone metadata (Section 13 of the spec).
create table camera_zones (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid not null references floors(id) on delete cascade,
  name text not null, -- e.g. "Cam 1 - Wide", "Cam 2 - Lane 3-4"
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Divisions, Athletes, Teams
-- ---------------------------------------------------------------------------

create table divisions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null, -- e.g. "Intermediate Female"
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table athletes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  affiliate text, -- "box" / team gym
  photo_url text,
  created_at timestamptz not null default now()
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  affiliate text,
  created_at timestamptz not null default now()
);

create table team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade,
  unique (team_id, athlete_id)
);

-- Roster entry: an athlete OR team competing in one division at one event.
create table registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  division_id uuid not null references divisions(id) on delete cascade,
  athlete_id uuid references athletes(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  bib_number text,
  created_at timestamptz not null default now(),
  check (
    (athlete_id is not null and team_id is null) or
    (athlete_id is null and team_id is not null)
  )
);

create index on registrations (event_id, division_id);

-- ---------------------------------------------------------------------------
-- WODs (with rules, scoring type, time cap, tie-break)
-- ---------------------------------------------------------------------------

create type scoring_type as enum ('for_time', 'amrap', 'max_load', 'points', 'other');
create type tiebreak_type as enum ('none', 'time', 'reps', 'load', 'points');
create type result_status as enum ('completed', 'dns', 'dnf', 'dq');

create table wods (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null, -- e.g. "WOD 2"
  description text,
  rules text,
  scoring_type scoring_type not null,
  time_cap_seconds int,
  tiebreak_type tiebreak_type not null default 'none',
  lower_is_better boolean not null default false, -- true for for_time; false for amrap/max_load/points
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Heats & Lanes
-- ---------------------------------------------------------------------------

create table heats (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  floor_id uuid not null references floors(id) on delete cascade,
  wod_id uuid not null references wods(id) on delete cascade,
  division_id uuid not null references divisions(id) on delete cascade,
  heat_number int not null,
  heat_count int, -- "6 of 9" — total heats for this wod/division, denormalized for display
  scheduled_start timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  unique (wod_id, division_id, heat_number)
);

create index on heats (floor_id, wod_id);

create table lanes (
  id uuid primary key default gen_random_uuid(),
  heat_id uuid not null references heats(id) on delete cascade,
  lane_number int not null,
  athlete_id uuid references athletes(id) on delete set null,
  team_id uuid references teams(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (heat_id, lane_number),
  check (athlete_id is null or team_id is null) -- at most one of the two
);

-- ---------------------------------------------------------------------------
-- Results (RAW, per scoring type) & Standings (COMPUTED)
-- ---------------------------------------------------------------------------

create table results (
  id uuid primary key default gen_random_uuid(),
  heat_id uuid not null references heats(id) on delete cascade,
  wod_id uuid not null references wods(id) on delete cascade,
  athlete_id uuid references athletes(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  -- raw result fields — exactly one set populated, matching the WOD's scoring_type
  time_seconds numeric, -- for_time
  reps int, -- amrap, or reps-completed-if-capped for for_time
  load numeric, -- max_load
  points numeric, -- points
  capped boolean not null default false, -- true if a for_time result hit the time cap
  status result_status not null default 'completed',
  tiebreak_value numeric,
  notes text,
  entered_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (heat_id, athlete_id),
  unique (heat_id, team_id),
  check (athlete_id is not null or team_id is not null)
);

-- Computed standings — always derivable from results via the scoring engine.
-- Rebuilt (not hand-edited) whenever results or scoring rules change.
create table standings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  division_id uuid not null references divisions(id) on delete cascade,
  wod_id uuid references wods(id) on delete cascade, -- null = overall standings
  athlete_id uuid references athletes(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  placement int,
  points numeric,
  computed_at timestamptz not null default now(),
  unique (division_id, wod_id, athlete_id),
  unique (division_id, wod_id, team_id)
);

-- ---------------------------------------------------------------------------
-- Sponsors
-- ---------------------------------------------------------------------------

create type sponsor_tier as enum (
  'logo_sponsor',       -- $50/event
  'brand_mention',      -- $75/event
  'commercial_30',      -- $90, 3x :30 insertions
  'commercial_30_plus', -- $150, 6x :30 insertions
  'wod_sponsor',        -- $200
  'presenting_sponsor'  -- $450
);

create table sponsors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  business_name text not null,
  logo_url text,
  website text,
  category text, -- e.g. "Physical Therapy" — used for exclusivity
  category_exclusive boolean not null default false,
  tier sponsor_tier not null,
  active boolean not null default true,
  commercial_video_url text,
  notes text,
  created_at timestamptz not null default now()
);

-- Enforce at most one ACTIVE exclusive sponsor per category per event.
create unique index sponsors_category_exclusive_uidx
  on sponsors (event_id, category)
  where category_exclusive and active;

-- ---------------------------------------------------------------------------
-- Broadcast state — ONE SOURCE OF TRUTH per floor, read by every overlay
-- ---------------------------------------------------------------------------

create type active_graphic as enum (
  'none', 'heat_intro', 'lanes', 'wod', 'timer', 'score', 'leaderboard', 'lower_third', 'sponsor'
);

create type timer_status as enum ('idle', 'running', 'paused', 'ended');
create type timer_direction as enum ('count_up', 'count_down');

create table broadcast_state (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid not null unique references floors(id) on delete cascade,
  current_heat_id uuid references heats(id) on delete set null,
  active_graphic active_graphic not null default 'none',
  lower_third_athlete_id uuid references athletes(id) on delete set null,
  active_sponsor_id uuid references sponsors(id) on delete set null,
  -- server-authoritative timer: clients derive elapsed time from the anchor,
  -- they never run their own independent countdown.
  timer_status timer_status not null default 'idle',
  timer_direction timer_direction not null default 'count_down',
  timer_duration_seconds int not null default 0,
  timer_elapsed_at_anchor numeric not null default 0,
  timer_anchor_time timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

-- ---------------------------------------------------------------------------
-- Operator action log (reliability requirement: log important actions)
-- ---------------------------------------------------------------------------

create table operator_actions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  floor_id uuid references floors(id) on delete set null,
  user_id uuid references auth.users(id),
  action text not null, -- e.g. "heat_change", "timer_start", "graphic_show"
  details jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger events_set_updated_at before update on events
  for each row execute function set_updated_at();
create trigger results_set_updated_at before update on results
  for each row execute function set_updated_at();
create trigger broadcast_state_set_updated_at before update on broadcast_state
  for each row execute function set_updated_at();
