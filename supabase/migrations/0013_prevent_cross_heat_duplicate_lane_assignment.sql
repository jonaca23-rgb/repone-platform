-- 0012 added `unique (heat_id, athlete_id)` / `unique (heat_id, team_id)` on
-- `lanes`, which stops the same athlete/team being placed in two lanes of
-- the SAME heat. It does NOT stop the same athlete/team being placed in a
-- lane of a DIFFERENT heat for the same WOD + division — which is just as
-- much a mistake: an athlete only ever runs one heat per WOD/division, so a
-- second one means they'd be scored twice for the same WOD, or their real
-- heat would show them missing from the roster. The app now checks for this
-- before saving (`assignLane` in src/lib/actions/lanes.ts, and the Heat
-- detail page now flags any existing cross-heat conflict in red), but as
-- with 0012, the schema itself should be the real backstop, not just the UI.
--
-- `lanes` doesn't carry `wod_id`/`division_id` directly (only `heat_id`), so
-- a plain unique index can't express "unique per wod+division" the way
-- 0012's `unique (heat_id, athlete_id)` could — this uses a trigger instead,
-- which can join through `heats` to find the real conflict.

-- --- Clean up any existing cross-heat duplicates first ---------------------
-- (0012's cleanup only looked *within* a single heat; this catches the same
-- athlete/team already split across two heats of the same wod+division.)
-- Keeps the lowest heat_number/lane_number pairing, clears the rest back to
-- empty so the operator can see the gap and reassign deliberately.
with ranked as (
  select l.id,
         row_number() over (
           partition by h.wod_id, h.division_id, l.athlete_id
           order by h.heat_number, l.lane_number
         ) as rn
  from lanes l
  join heats h on h.id = l.heat_id
  where l.athlete_id is not null
)
update lanes set athlete_id = null
where id in (select id from ranked where rn > 1);

with ranked as (
  select l.id,
         row_number() over (
           partition by h.wod_id, h.division_id, l.team_id
           order by h.heat_number, l.lane_number
         ) as rn
  from lanes l
  join heats h on h.id = l.heat_id
  where l.team_id is not null
)
update lanes set team_id = null
where id in (select id from ranked where rn > 1);

-- --- Prevent it from happening again ---------------------------------------
create or replace function prevent_cross_heat_duplicate_lane_assignment()
returns trigger
language plpgsql
as $$
declare
  conflict_heat_number int;
  conflict_lane_number int;
begin
  if new.athlete_id is not null then
    select h2.heat_number, l2.lane_number
      into conflict_heat_number, conflict_lane_number
      from lanes l2
      join heats h2 on h2.id = l2.heat_id
      join heats h1 on h1.id = new.heat_id
      where l2.athlete_id = new.athlete_id
        and l2.id <> new.id
        and h2.wod_id = h1.wod_id
        and h2.division_id = h1.division_id
      limit 1;
    if found then
      raise exception 'Athlete already assigned to Heat %, Lane % for this WOD/division', conflict_heat_number, conflict_lane_number
        using errcode = '23505';
    end if;
  end if;

  if new.team_id is not null then
    select h2.heat_number, l2.lane_number
      into conflict_heat_number, conflict_lane_number
      from lanes l2
      join heats h2 on h2.id = l2.heat_id
      join heats h1 on h1.id = new.heat_id
      where l2.team_id = new.team_id
        and l2.id <> new.id
        and h2.wod_id = h1.wod_id
        and h2.division_id = h1.division_id
      limit 1;
    if found then
      raise exception 'Team already assigned to Heat %, Lane % for this WOD/division', conflict_heat_number, conflict_lane_number
        using errcode = '23505';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists lanes_prevent_cross_heat_duplicate on lanes;
create trigger lanes_prevent_cross_heat_duplicate
  before insert or update on lanes
  for each row
  execute function prevent_cross_heat_duplicate_lane_assignment();
