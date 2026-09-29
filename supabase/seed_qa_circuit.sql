-- ============================================================================
-- RepOne Platform — QA Sample Data
-- One circuit, 3 events, 3 floors per event, 60 athletes across 4 divisions
-- ============================================================================
--
-- WHAT THIS CREATES (all inside your existing organization):
--   * 1 circuit: "QA Test Circuit — 2026 Sample Season"
--   * 3 events (circuit stops), each with 1 venue and 3 floors (Floor A/B/C)
--   * 4 divisions per event, same names at every stop so the circuit
--     leaderboard merges them correctly: Rx Male, Rx Female, Scaled Male,
--     Scaled Female
--   * 60 athletes (15 per division), registered into the same division at
--     all 3 events, like a real circuit roster
--   * 3 WODs per event (for_time, amrap, max_load — exercises all three
--     scoring paths), with heats (8 lanes each) spread across the 3 floors
--   * Results for every athlete/WOD, with per-WOD and per-event overall
--     standings pre-computed the same way the app computes them, so the
--     Circuits leaderboard works immediately without re-entering scores
--
-- PREREQUISITES: run this AFTER supabase/migrations/0008_circuits.sql.
-- It assumes you already have exactly one organization (created when you
-- first signed in) — it seeds into that organization.
--
-- SAFE TO RE-RUN? No — running it twice creates a second copy of everything
-- (new random IDs, same names). Run once. To remove all of this later, run
-- supabase/seed_qa_circuit_teardown.sql.
--
-- Everything below runs in one transaction: if anything fails, nothing is
-- left half-written.
-- ============================================================================

begin;

do $$
begin
  if to_regclass('public.circuits') is null then
    raise exception 'circuits table not found — run supabase/migrations/0008_circuits.sql first, then re-run this script.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 0. Target organization
-- ---------------------------------------------------------------------------
create temporary table tmp_org as
select id as org_id from organizations order by created_at asc limit 1;

do $$
begin
  if not exists (select 1 from tmp_org) then
    raise exception 'No organization found — sign in and create your organization first.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Circuit
-- ---------------------------------------------------------------------------
create temporary table tmp_circuit as
with ins as (
  insert into circuits (organization_id, name, description, starts_on, ends_on)
  select org_id,
         'QA Test Circuit — 2026 Sample Season',
         'Auto-generated sample data for testing. Safe to delete — see seed_qa_circuit_teardown.sql.',
         '2026-08-01', '2026-10-15'
  from tmp_org
  returning id
)
select id as circuit_id from ins;

-- ---------------------------------------------------------------------------
-- 2. Events (3 stops)
-- ---------------------------------------------------------------------------
create temporary table tmp_event_seed (
  event_seq int, name text, status event_status, starts_on date, ends_on date, start_ts timestamptz
);
insert into tmp_event_seed values
  (1, 'QA Circuit — Stop 1: Bayamon Showdown',  'completed', '2026-08-08', '2026-08-08', '2026-08-08 09:00:00-04'),
  (2, 'QA Circuit — Stop 2: San Juan Throwdown','completed', '2026-09-05', '2026-09-05', '2026-09-05 09:00:00-04'),
  (3, 'QA Circuit — Stop 3: Caguas Finale',     'live',      '2026-09-08', '2026-09-08', '2026-09-08 09:00:00-04');

create temporary table tmp_events as
with ins as (
  insert into events (organization_id, circuit_id, name, status, starts_on, ends_on)
  select o.org_id, c.circuit_id, s.name, s.status, s.starts_on, s.ends_on
  from tmp_event_seed s cross join tmp_org o cross join tmp_circuit c
  returning id, name
)
select e.id as event_id, s.event_seq
from ins e join tmp_event_seed s on s.name = e.name;

-- ---------------------------------------------------------------------------
-- 3. Venue + 3 floors per event
-- ---------------------------------------------------------------------------
create temporary table tmp_venues as
with ins as (
  insert into venues (event_id, name)
  select event_id, 'Main Venue' from tmp_events
  returning id, event_id
)
select id as venue_id, event_id from ins;

create temporary table tmp_floor_seed(floor_seq int, name text);
insert into tmp_floor_seed values (1,'Floor A'), (2,'Floor B'), (3,'Floor C');

create temporary table tmp_floors as
with ins as (
  insert into floors (venue_id, name, sort_order)
  select v.venue_id, f.name, f.floor_seq - 1
  from tmp_venues v cross join tmp_floor_seed f
  returning id, venue_id, name
)
select i.id as floor_id, v.event_id, f.floor_seq
from ins i
join tmp_venues v on v.venue_id = i.venue_id
join tmp_floor_seed f on f.name = i.name;

-- one idle broadcast_state row per floor, same as a real event would have
insert into broadcast_state (floor_id)
select floor_id from tmp_floors;

-- ---------------------------------------------------------------------------
-- 4. Divisions — same 4 names at every stop so the circuit leaderboard merges
-- ---------------------------------------------------------------------------
create temporary table tmp_division_seed(division_seq int, name text);
insert into tmp_division_seed values
  (1,'Rx Male'), (2,'Rx Female'), (3,'Scaled Male'), (4,'Scaled Female');

create temporary table tmp_divisions as
with ins as (
  insert into divisions (event_id, name, sort_order)
  select e.event_id, d.name, d.division_seq - 1
  from tmp_events e cross join tmp_division_seed d
  returning id, event_id, name
)
select i.id as division_id, i.event_id, d.division_seq
from ins i join tmp_division_seed d on d.name = i.name;

-- ---------------------------------------------------------------------------
-- 5. Athletes — 60 total (org-scoped, shared across all 3 events)
-- ---------------------------------------------------------------------------
create temporary table tmp_athlete_seed(athlete_seq int, division_seq int, first_name text, last_name text, affiliate text);
insert into tmp_athlete_seed values
  (1,1,'Carlos','Rivera','CrossFit Aprieta'),
  (2,1,'Miguel','Torres','Box 787'),
  (3,1,'Luis','Ortiz','CrossFit San Juan'),
  (4,1,'Jose','Ramirez','CrossFit Bayamon'),
  (5,1,'Angel','Cruz','Titan Box PR'),
  (6,1,'Rafael','Mendez','CrossFit Borinquen'),
  (7,1,'David','Colon','CrossFit Aprieta'),
  (8,1,'Emilio','Vega','Box 787'),
  (9,1,'Hector','Rosario','CrossFit San Juan'),
  (10,1,'Julio','Feliciano','CrossFit Bayamon'),
  (11,1,'Manuel','Diaz','Titan Box PR'),
  (12,1,'Pedro','Santiago','CrossFit Borinquen'),
  (13,1,'Ricardo','Aponte','CrossFit Aprieta'),
  (14,1,'Samuel','Nieves','Box 787'),
  (15,1,'Victor','Maldonado','CrossFit San Juan'),
  (16,2,'Ana','Delgado','CrossFit Bayamon'),
  (17,2,'Camila','Ortiz','Titan Box PR'),
  (18,2,'Valentina','Cruz','CrossFit Borinquen'),
  (19,2,'Isabella','Vega','CrossFit Aprieta'),
  (20,2,'Gabriela','Torres','Box 787'),
  (21,2,'Daniela','Rosario','CrossFit San Juan'),
  (22,2,'Sofia','Feliciano','CrossFit Bayamon'),
  (23,2,'Paula','Diaz','Titan Box PR'),
  (24,2,'Carmen','Santiago','CrossFit Borinquen'),
  (25,2,'Natalia','Aponte','CrossFit Aprieta'),
  (26,2,'Andrea','Nieves','Box 787'),
  (27,2,'Laura','Maldonado','CrossFit San Juan'),
  (28,2,'Estrella','Mendez','CrossFit Bayamon'),
  (29,2,'Yolanda','Colon','Titan Box PR'),
  (30,2,'Michelle','Ramirez','CrossFit Borinquen'),
  (31,3,'Jorge','Fuentes','CrossFit Aprieta'),
  (32,3,'Roberto','Cabrera','Box 787'),
  (33,3,'Alejandro','Reyes','CrossFit San Juan'),
  (34,3,'Francisco','Morales','CrossFit Bayamon'),
  (35,3,'Eduardo','Sosa','Titan Box PR'),
  (36,3,'Enrique','Padilla','CrossFit Borinquen'),
  (37,3,'Ivan','Rosado','CrossFit Aprieta'),
  (38,3,'Marcos','Villanueva','Box 787'),
  (39,3,'Nestor','Cotto','CrossFit San Juan'),
  (40,3,'Omar','Serrano','CrossFit Bayamon'),
  (41,3,'Pablo','Betancourt','Titan Box PR'),
  (42,3,'Raul','Figueroa','CrossFit Borinquen'),
  (43,3,'Tomas','Guzman','CrossFit Aprieta'),
  (44,3,'Wilfredo','Lugo','Box 787'),
  (45,3,'Xavier','Perez','CrossFit San Juan'),
  (46,4,'Adriana','Sanchez','CrossFit Bayamon'),
  (47,4,'Brenda','Cardona','Titan Box PR'),
  (48,4,'Claudia','Ayala','CrossFit Borinquen'),
  (49,4,'Diana','Rentas','CrossFit Aprieta'),
  (50,4,'Elena','Caban','Box 787'),
  (51,4,'Fernanda','Rivas','CrossFit San Juan'),
  (52,4,'Gloria','Marrero','CrossFit Bayamon'),
  (53,4,'Heidi','Class','Titan Box PR'),
  (54,4,'Ingrid','Bermudez','CrossFit Borinquen'),
  (55,4,'Jazmin','Correa','CrossFit Aprieta'),
  (56,4,'Karla','Ocasio','Box 787'),
  (57,4,'Leslie','Quinones','CrossFit San Juan'),
  (58,4,'Miriam','Acevedo','CrossFit Bayamon'),
  (59,4,'Noemi','Renteria','Titan Box PR'),
  (60,4,'Patricia','Andino','CrossFit Borinquen');

create temporary table tmp_athletes as
with ins as (
  insert into athletes (organization_id, first_name, last_name, affiliate, email)
  select o.org_id, a.first_name, a.last_name, a.affiliate,
         format('qa.athlete%s@example.test', a.athlete_seq)
  from tmp_athlete_seed a cross join tmp_org o
  returning id, first_name, last_name
)
select i.id as athlete_id, a.athlete_seq, a.division_seq
from ins i join tmp_athlete_seed a on a.first_name = i.first_name and a.last_name = i.last_name;

-- ---------------------------------------------------------------------------
-- 6. Registrations — every athlete competes in the same division at all 3 events
-- ---------------------------------------------------------------------------
insert into registrations (event_id, division_id, athlete_id, bib_number)
select d.event_id, d.division_id, a.athlete_id, lpad(a.athlete_seq::text, 3, '0')
from tmp_athletes a
join tmp_divisions d on d.division_seq = a.division_seq;

-- ---------------------------------------------------------------------------
-- 7. WODs — 3 per event, one of each scoring type
-- ---------------------------------------------------------------------------
create temporary table tmp_wod_seed(
  wod_seq int, name text, scoring_type scoring_type, time_cap_seconds int,
  tiebreak_type tiebreak_type, lower_is_better boolean, description text
);
insert into tmp_wod_seed values
  (1, 'WOD 1', 'for_time', 900, 'reps', true,
   'For Time: 21-15-9 Thrusters (95/65) and Pull-ups'),
  (2, 'WOD 2', 'amrap', 720, 'none', false,
   '12-Minute AMRAP: 10 Box Jumps, 10 Wall Balls, 10 Kettlebell Swings'),
  (3, 'WOD 3', 'max_load', null, 'none', false,
   '1-Rep-Max Clean & Jerk, 10-minute window');

create temporary table tmp_wods as
with ins as (
  insert into wods (event_id, name, description, scoring_type, time_cap_seconds, tiebreak_type, lower_is_better, sort_order)
  select e.event_id, w.name, w.description, w.scoring_type, w.time_cap_seconds, w.tiebreak_type, w.lower_is_better, w.wod_seq - 1
  from tmp_events e cross join tmp_wod_seed w
  returning id, event_id, name
)
select i.id as wod_id, i.event_id, w.wod_seq, w.scoring_type
from ins i join tmp_wod_seed w on w.name = i.name;

-- ---------------------------------------------------------------------------
-- 8. Heats + lanes — 8 lanes/heat, divisions spread across the 3 floors
-- ---------------------------------------------------------------------------
create temporary table tmp_div_floor(division_seq int, floor_seq int);
insert into tmp_div_floor values (1,1), (2,2), (3,3), (4,1);

create temporary table tmp_roster as
select
  dv.event_id, dv.division_id, dv.division_seq, w.wod_id, w.wod_seq, w.scoring_type,
  a.athlete_id, a.athlete_seq,
  row_number() over (partition by dv.event_id, dv.division_id, w.wod_id order by a.athlete_seq) as rn
from tmp_divisions dv
join tmp_athletes a on a.division_seq = dv.division_seq
join tmp_wods w on w.event_id = dv.event_id;

create temporary table tmp_heats_seed as
select distinct
  event_id, division_id, wod_id, wod_seq,
  ceil(rn / 8.0)::int as heat_number,
  max(ceil(rn / 8.0)::int) over (partition by wod_id, division_id) as heat_count
from tmp_roster;

create temporary table tmp_heats as
with ins as (
  insert into heats (event_id, floor_id, wod_id, division_id, heat_number, heat_count, scheduled_start, started_at, ended_at)
  select
    hs.event_id, fl.floor_id, hs.wod_id, hs.division_id, hs.heat_number, hs.heat_count,
    tes.start_ts + ((hs.wod_seq - 1) * 45 + (hs.heat_number - 1) * 7) * interval '1 minute',
    tes.start_ts + ((hs.wod_seq - 1) * 45 + (hs.heat_number - 1) * 7) * interval '1 minute',
    tes.start_ts + ((hs.wod_seq - 1) * 45 + (hs.heat_number - 1) * 7) * interval '1 minute' + interval '10 minutes'
  from tmp_heats_seed hs
  join tmp_divisions dv on dv.division_id = hs.division_id
  join tmp_div_floor df on df.division_seq = dv.division_seq
  join tmp_floors fl on fl.event_id = hs.event_id and fl.floor_seq = df.floor_seq
  join tmp_events te on te.event_id = hs.event_id
  join tmp_event_seed tes on tes.event_seq = te.event_seq
  returning id, event_id, wod_id, division_id, heat_number
)
select id as heat_id, event_id, wod_id, division_id, heat_number from ins;

insert into lanes (heat_id, lane_number, athlete_id)
select h.heat_id, ((r.rn - 1) % 8) + 1, r.athlete_id
from tmp_roster r
join tmp_heats h
  on h.event_id = r.event_id and h.wod_id = r.wod_id and h.division_id = r.division_id
 and h.heat_number = ceil(r.rn / 8.0)::int;

-- ---------------------------------------------------------------------------
-- 9. Results — one plausible raw score per athlete per WOD (with jitter)
-- ---------------------------------------------------------------------------
create temporary table tmp_results as
with ins as (
  insert into results (heat_id, wod_id, athlete_id, time_seconds, reps, load, capped, status)
  select
    h.heat_id, r.wod_id, r.athlete_id,
    case when r.scoring_type = 'for_time' then 480 + r.rn * 6 + floor(random() * 20) end,
    case when r.scoring_type = 'amrap' then greatest(50, 220 - r.rn * 4 - floor(random() * 12))::int end,
    case when r.scoring_type = 'max_load' then greatest(95, 315 - r.rn * 5 - floor(random() * 10)) end,
    false, 'completed'
  from tmp_roster r
  join tmp_heats h
    on h.event_id = r.event_id and h.wod_id = r.wod_id and h.division_id = r.division_id
   and h.heat_number = ceil(r.rn / 8.0)::int
  returning athlete_id, wod_id, time_seconds, reps, load
)
select * from ins;

-- ---------------------------------------------------------------------------
-- 10. Standings — per-WOD placements, then per-event overall (same rules the
--     app's scoring engine uses: standard competition ranking, points = placement)
-- ---------------------------------------------------------------------------
insert into standings (event_id, division_id, wod_id, athlete_id, placement, points)
select
  r.event_id, r.division_id, r.wod_id, r.athlete_id,
  rank() over (
    partition by r.division_id, r.wod_id
    order by
      case when r.scoring_type = 'for_time' then res.time_seconds end asc,
      case when r.scoring_type = 'amrap' then res.reps end desc,
      case when r.scoring_type = 'max_load' then res.load end desc
  ) as placement,
  rank() over (
    partition by r.division_id, r.wod_id
    order by
      case when r.scoring_type = 'for_time' then res.time_seconds end asc,
      case when r.scoring_type = 'amrap' then res.reps end desc,
      case when r.scoring_type = 'max_load' then res.load end desc
  ) as points
from tmp_roster r
join tmp_results res on res.athlete_id = r.athlete_id and res.wod_id = r.wod_id;

insert into standings (event_id, division_id, wod_id, athlete_id, placement, points)
select event_id, division_id, null::uuid, athlete_id,
       rank() over (partition by division_id order by total_points asc),
       total_points
from (
  select r.event_id, r.division_id, r.athlete_id, sum(s.points) as total_points
  from tmp_roster r
  join standings s
    on s.athlete_id = r.athlete_id and s.division_id = r.division_id and s.wod_id = r.wod_id
  group by r.event_id, r.division_id, r.athlete_id
) totals;

commit;
