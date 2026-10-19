-- ---------------------------------------------------------------------------
-- 0039 — A finished heat's lanes are the organizers' too
--
-- 0034 left a finished heat's results and the heat itself to the organizers
-- (admin, event director). Its lanes stayed writable by floor staff, and
-- emptying a lane hides that competitor from the scoring screens and makes
-- the organizer's correction for them refused ("not in this heat"). Lanes of
-- a finished heat now follow the same rule. Requests with no user (seeds,
-- the service role) and a heat already gone (a cascade) pass.
-- ---------------------------------------------------------------------------

create or replace function guard_finished_heat_lanes() returns trigger as $$
declare
  v_heat uuid := coalesce(new.heat_id, old.heat_id);
  v_ended timestamptz;
  v_org uuid;
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  select h.ended_at, e.organization_id into v_ended, v_org
  from heats h join events e on e.id = h.event_id
  where h.id = v_heat;
  if v_ended is null then
    return coalesce(new, old);
  end if;
  if not has_role(v_org, array['admin','event_director']::user_role[]) then
    raise exception 'heat_finished: only an admin or event director can change a finished heat'
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql security definer set search_path = public;

create trigger lanes_guard_finished
  before insert or update or delete on lanes
  for each row execute function guard_finished_heat_lanes();
