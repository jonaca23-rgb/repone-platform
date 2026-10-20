-- ---------------------------------------------------------------------------
-- 0026 — Atomic standings rewrites (audit finding C3)
--
-- The app rebuilt a division's standings with a DELETE then an INSERT from
-- the server, two separate requests with errors ignored. Two scorekeepers
-- saving at once could interleave them into a duplicated or empty live
-- leaderboard, and nothing stopped duplicates: the unique keys include
-- wod_id, which is NULL for overall rows, and NULLs never conflict.
-- Proven by scripts/standings-check.ts (pnpm db:standings-check).
-- ---------------------------------------------------------------------------

-- Each row is one competitor: an athlete or a team, never both or neither.
alter table standings
  add constraint standings_one_competitor check (num_nonnulls(athlete_id, team_id) = 1);

-- One row per competitor per WOD, and one overall (wod_id NULL) row.
alter table standings drop constraint if exists standings_division_id_wod_id_athlete_id_key;
alter table standings drop constraint if exists standings_division_id_wod_id_team_id_key;
create unique index standings_athlete_unique on standings (division_id, wod_id, athlete_id)
  nulls not distinct where athlete_id is not null;
create unique index standings_team_unique on standings (division_id, wod_id, team_id)
  nulls not distinct where team_id is not null;

-- Replaces one division's standings for one WOD (or overall, p_wod_id NULL)
-- in a single transaction. A transaction-scoped advisory lock queues
-- concurrent calls for the same division+WOD, so each rewrite sees the
-- previous one's rows and replaces them whole. SECURITY INVOKER: the
-- caller's standings policies (admin/event_director/scoring_operator,
-- assigned scorekeeper or producer) still decide whether it may write.
create or replace function replace_standings(p_division_id uuid, p_wod_id uuid, p_rows jsonb)
returns void as $$
declare
  v_event_id uuid;
begin
  select event_id into v_event_id from divisions where id = p_division_id;
  if v_event_id is null then
    raise exception 'Unknown division %', p_division_id;
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

revoke execute on function replace_standings(uuid, uuid, jsonb) from public, anon;
grant execute on function replace_standings(uuid, uuid, jsonb) to authenticated;

-- Standings are recomputed as whoever saved the score, usually an assigned
-- scorekeeper, and overall standings need the division's full registered
-- field (competitors with no result count as last once a WOD is finished).
-- Registrations were readable only by admins/event directors and the athlete
-- themselves, so a scorekeeper's recompute silently saw an empty field.
create policy "event staff read event registrations" on registrations for select
  using (
    is_event_scorekeeper(registrations.event_id)
    or is_event_producer(registrations.event_id)
    or is_event_commentator(registrations.event_id)
  );
