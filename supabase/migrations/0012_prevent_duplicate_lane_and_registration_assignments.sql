-- Root-cause fix for a reported bug: the Score Keeper screen crashed with a
-- React "duplicate key" error because the same athlete_id showed up in two
-- lanes of one heat. Nothing in the schema stopped that:
--   - The "Lane Assignment" picker on the Heat detail page (assignLane())
--     let an operator pick the same athlete into two different lanes of the
--     same heat.
--   - registerAthlete()/registerTeam() let the same athlete/team be
--     registered twice into the same event+division, and generateHeats()
--     would then place both registrations into lanes — sometimes both
--     landing in the same heat.
-- The application code now checks for this before saving (see
-- lib/actions/lanes.ts and lib/actions/registrations.ts), but this migration
-- is the real fix: it cleans up any data that already violates the rule and
-- adds unique constraints so it can't happen again from any code path,
-- including ones we haven't written yet.
--
-- Postgres unique constraints treat NULL as distinct from every other NULL,
-- so empty lanes and non-athlete/non-team registrations are unaffected —
-- these constraints only ever compare rows that share a real id.

-- --- Clean up existing duplicate lane assignments -------------------------
-- Keep the lowest lane_number for each (heat_id, athlete_id) / (heat_id,
-- team_id); clear the athlete/team back off the later lane(s) so the
-- operator can see the gap and re-assign deliberately.
with dupes as (
  select id,
         row_number() over (partition by heat_id, athlete_id order by lane_number) as rn
  from lanes
  where athlete_id is not null
)
update lanes set athlete_id = null
where id in (select id from dupes where rn > 1);

with dupes as (
  select id,
         row_number() over (partition by heat_id, team_id order by lane_number) as rn
  from lanes
  where team_id is not null
)
update lanes set team_id = null
where id in (select id from dupes where rn > 1);

-- --- Clean up existing duplicate registrations ----------------------------
-- Keep the earliest registration for each (event_id, division_id,
-- athlete_id) / (event_id, division_id, team_id); remove later duplicates.
-- Note: deleting a registration cascades to any payment_line_items tied to
-- it (0007_payments_and_teams.sql) — if you've taken payments and want to
-- double-check which row is kept before this runs, query the dupes first:
--   select * from registrations r where exists (
--     select 1 from registrations r2 where r2.event_id = r.event_id
--       and r2.division_id = r.division_id and r2.athlete_id = r.athlete_id
--       and r2.id <> r.id);
with dupes as (
  select id,
         row_number() over (partition by event_id, division_id, athlete_id order by created_at) as rn
  from registrations
  where athlete_id is not null
)
delete from registrations where id in (select id from dupes where rn > 1);

with dupes as (
  select id,
         row_number() over (partition by event_id, division_id, team_id order by created_at) as rn
  from registrations
  where team_id is not null
)
delete from registrations where id in (select id from dupes where rn > 1);

-- --- Prevent it from happening again ---------------------------------------
alter table lanes
  add constraint lanes_heat_athlete_unique unique (heat_id, athlete_id);
alter table lanes
  add constraint lanes_heat_team_unique unique (heat_id, team_id);

alter table registrations
  add constraint registrations_event_division_athlete_unique unique (event_id, division_id, athlete_id);
alter table registrations
  add constraint registrations_event_division_team_unique unique (event_id, division_id, team_id);
