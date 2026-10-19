-- ---------------------------------------------------------------------------
-- 0040 — A heat's WOD, division and floor belong to the heat's own event
--
-- The heats policies only test heats.event_id, and the server now writes
-- standings over the owner connection (0038) for whatever WOD and division
-- a heat names. Floor staff of one event could point their heat at another
-- event's division and have the server rewrite that event's leaderboard.
-- These are invariants, so they hold for every writer, the service role too.
-- replace_standings also refuses a WOD from another event than the division's.
-- ---------------------------------------------------------------------------

create or replace function heat_parts_same_event() returns trigger as $$
begin
  if not exists (select 1 from wods where id = new.wod_id and event_id = new.event_id)
     or not exists (select 1 from divisions where id = new.division_id and event_id = new.event_id)
     or not exists (
       select 1 from floors f join venues v on v.id = f.venue_id
       where f.id = new.floor_id and v.event_id = new.event_id
     ) then
    raise exception 'heat_event_mismatch: a heat''s WOD, division and floor must belong to its event'
      using errcode = '23514';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger heats_parts_same_event
  before insert or update of event_id, wod_id, division_id, floor_id on heats
  for each row execute function heat_parts_same_event();

create or replace function replace_standings(p_division_id uuid, p_wod_id uuid, p_rows jsonb)
returns void as $$
declare
  v_event_id uuid;
begin
  select event_id into v_event_id from divisions where id = p_division_id;
  if v_event_id is null then
    raise exception 'Unknown division %', p_division_id;
  end if;
  if p_wod_id is not null
     and not exists (select 1 from wods where id = p_wod_id and event_id = v_event_id) then
    raise exception 'WOD % is not in the division''s event', p_wod_id;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('standings:' || p_division_id::text || ':' || coalesce(p_wod_id::text, 'overall'), 0)
  );

  delete from standings
  where division_id = p_division_id and wod_id is not distinct from p_wod_id;

  insert into standings (event_id, division_id, wod_id, athlete_id, team_id, placement, points)
  select v_event_id, p_division_id, p_wod_id, r.athlete_id, r.team_id, r.placement, r.points
  from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
    as r(athlete_id uuid, team_id uuid, placement int, points numeric);
end;
$$ language plpgsql security invoker set search_path = public;
