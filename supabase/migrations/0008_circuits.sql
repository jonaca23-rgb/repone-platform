-- RepOne Platform — Circuits / Leagues
--
-- Lets an organizer group multiple events into a season/circuit so a
-- competitor's placement at each stop rolls up into one cumulative
-- leaderboard, instead of every event only ever producing its own
-- standalone leaderboard.
--
-- DESIGN — kept intentionally light, alongside the existing schema rather
-- than replacing anything:
--  * `circuits` is a new, simple grouping table (name + optional season
--    dates). It does not own events; it is merely pointed at.
--  * `events.circuit_id` is a single nullable FK. A standalone ("Single
--    Event") event just leaves it null and behaves exactly as it always
--    has — nothing about event creation, heats, results, or per-event
--    standings changes. An event that's a stop on a circuit sets it once.
--  * `on delete set null` (not cascade): deleting a circuit un-links its
--    events rather than destroying their data — a circuit is just a lens
--    on top of events that still stand on their own.
--  * There is deliberately NO new "circuit_standings" table. Circuit-wide
--    leaderboards are computed live, at read time, in the admin UI, from
--    the per-event `standings` rows that already exist (the `wod_id is
--    null` "overall for this division at this event" rows the scoring
--    engine already maintains — see recomputeOverallStandings in
--    src/lib/actions/standings.ts). This matches the schema's existing
--    "standings are always derived/rebuildable, never hand-edited"
--    principle even more literally: there's nothing to rebuild because
--    nothing is stored. Competitors are matched across events by their
--    stable athlete_id/team_id (org-wide identities), and divisions are
--    matched across events by name (there is no shared division entity
--    across events today, so this assumes an organizer reuses the same
--    division names — e.g. "Rx Male" — at every stop of a circuit).

create table circuits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table events
  add column circuit_id uuid references circuits(id) on delete set null;

create index on events (circuit_id);

create trigger circuits_set_updated_at before update on circuits
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — same convention as divisions/fee_schedules: a circuit's name/season
-- isn't sensitive, so it's public-read (useful for a future public circuit
-- standings page); writes are organizer-only. No new policy is needed for
-- `events.circuit_id` itself — the existing "org staff manage events" policy
-- (0002_rls_and_realtime.sql) already covers updates to any column on events.
-- ---------------------------------------------------------------------------

alter table circuits enable row level security;

create policy "public read circuits" on circuits for select using (true);

create policy "org staff manage circuits" on circuits for all
  using (has_role(organization_id, array['admin','event_director']::user_role[]))
  with check (has_role(organization_id, array['admin','event_director']::user_role[]));
