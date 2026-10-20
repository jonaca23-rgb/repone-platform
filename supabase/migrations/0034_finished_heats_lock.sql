-- ---------------------------------------------------------------------------
-- 0034 — A finished heat's results belong to the organizers
--
-- Scorekeepers and producers enter and correct results while a heat is open
-- and finish it (heats.ended_at). After that only the organization's managers
-- (admin, event director) adjust its results: the people on the floor can no
-- longer write them, reopen the heat or delete it. RLS and a trigger enforce
-- it so a direct API call can't get around the app.
-- ---------------------------------------------------------------------------

drop policy if exists "event scorekeeper manage results" on results;
drop policy if exists "event producer manage results" on results;
drop policy if exists "org production staff manage results" on results;
drop policy if exists "scoring staff manage results" on results;

create policy "org managers manage results" on results for all
  using (exists (
    select 1 from heats h join events e on e.id = h.event_id
    where h.id = results.heat_id
      and has_role(e.organization_id, array['admin','event_director']::user_role[])))
  with check (exists (
    select 1 from heats h join events e on e.id = h.event_id
    where h.id = results.heat_id
      and has_role(e.organization_id, array['admin','event_director']::user_role[])));

-- Event scorekeepers and producers, and the org-wide roles that match them
-- (0031), only while the heat is open.
create policy "floor staff manage results of open heats" on results for all
  using (exists (
    select 1 from heats h join events e on e.id = h.event_id
    where h.id = results.heat_id and h.ended_at is null
      and (is_event_scorekeeper(h.event_id) or is_event_producer(h.event_id)
           or has_role(e.organization_id, array['scoring_operator','production_director']::user_role[]))))
  with check (exists (
    select 1 from heats h join events e on e.id = h.event_id
    where h.id = results.heat_id and h.ended_at is null
      and (is_event_scorekeeper(h.event_id) or is_event_producer(h.event_id)
           or has_role(e.organization_id, array['scoring_operator','production_director']::user_role[]))));

-- Finishing is one-way for floor staff: once ended_at is set, only a manager
-- changes the heat at all (reopening it, or moving it to another WOD or
-- division, would take its results off the leaderboard) or deletes it (which
-- would take its results with it). Requests with no user (migrations, seeds,
-- the service role) pass; RLS already keeps anonymous visitors from writing
-- heats. When the event itself is being deleted its row is already gone and
-- the cascade passes: deleting events has its own policy.
create or replace function guard_finished_heat() returns trigger as $$
declare
  v_org uuid;
begin
  if old.ended_at is null or auth.uid() is null then
    return coalesce(new, old);
  end if;
  select organization_id into v_org from events where id = old.event_id;
  if v_org is null then
    return coalesce(new, old);
  end if;
  if not has_role(v_org, array['admin','event_director']::user_role[]) then
    raise exception 'heat_finished: only an admin or event director can change a finished heat'
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql security definer set search_path = public;

create trigger heats_guard_finished
  before update or delete on heats
  for each row execute function guard_finished_heat();
