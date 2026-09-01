-- RepOne Platform — RLS policies & Realtime wiring
--
-- Model:
--  * Broadcast overlays are unauthenticated browser-source pages (YoloBox/OBS/vMix),
--    so all read-facing competition/broadcast data is PUBLIC READ ONLY.
--  * All writes require authentication and an appropriate role.
--  * Roles are scoped to an organization and optionally to one event.

-- ---------------------------------------------------------------------------
-- Helper: does the current auth user hold `role` in this org (optionally event)?
-- ---------------------------------------------------------------------------

create or replace function has_role(
  p_organization_id uuid,
  p_roles user_role[],
  p_event_id uuid default null
) returns boolean as $$
  select exists (
    select 1 from user_roles ur
    where ur.user_id = auth.uid()
      and ur.organization_id = p_organization_id
      and ur.role = any(p_roles)
      and (ur.event_id is null or ur.event_id = p_event_id)
  );
$$ language sql stable security definer;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------

alter table organizations enable row level security;
alter table profiles enable row level security;
alter table user_roles enable row level security;
alter table events enable row level security;
alter table venues enable row level security;
alter table floors enable row level security;
alter table camera_zones enable row level security;
alter table divisions enable row level security;
alter table athletes enable row level security;
alter table teams enable row level security;
alter table team_members enable row level security;
alter table registrations enable row level security;
alter table wods enable row level security;
alter table heats enable row level security;
alter table lanes enable row level security;
alter table results enable row level security;
alter table standings enable row level security;
alter table sponsors enable row level security;
alter table broadcast_state enable row level security;
alter table operator_actions enable row level security;

-- ---------------------------------------------------------------------------
-- Public read access — everything an overlay or leaderboard needs to render.
-- ---------------------------------------------------------------------------

create policy "public read events" on events for select using (true);
create policy "public read venues" on venues for select using (true);
create policy "public read floors" on floors for select using (true);
create policy "public read divisions" on divisions for select using (true);
create policy "public read athletes" on athletes for select using (true);
create policy "public read teams" on teams for select using (true);
create policy "public read team_members" on team_members for select using (true);
create policy "public read wods" on wods for select using (true);
create policy "public read heats" on heats for select using (true);
create policy "public read lanes" on lanes for select using (true);
create policy "public read results" on results for select using (true);
create policy "public read standings" on standings for select using (true);
create policy "public read sponsors" on sponsors for select using (active = true);
create policy "public read broadcast_state" on broadcast_state for select using (true);

-- ---------------------------------------------------------------------------
-- Authenticated write access, scoped by role.
-- Admin / Event Director: full CRUD on event setup data.
-- Scoring Operator: results entry only.
-- Production Director: broadcast_state + operator_actions only.
-- ---------------------------------------------------------------------------

create policy "org staff manage events" on events for all
  using (has_role(organization_id, array['admin','event_director']::user_role[]))
  with check (has_role(organization_id, array['admin','event_director']::user_role[]));

create policy "org staff manage venues" on venues for all
  using (exists (select 1 from events e where e.id = venues.event_id
    and has_role(e.organization_id, array['admin','event_director']::user_role[])));

create policy "org staff manage floors" on floors for all
  using (exists (select 1 from venues v join events e on e.id = v.event_id
    where v.id = floors.venue_id
    and has_role(e.organization_id, array['admin','event_director']::user_role[])));

create policy "org staff manage divisions" on divisions for all
  using (exists (select 1 from events e where e.id = divisions.event_id
    and has_role(e.organization_id, array['admin','event_director']::user_role[])));

create policy "org staff manage athletes" on athletes for all
  using (has_role(organization_id, array['admin','event_director']::user_role[]));

create policy "org staff manage teams" on teams for all
  using (has_role(organization_id, array['admin','event_director']::user_role[]));

create policy "org staff manage team_members" on team_members for all
  using (exists (select 1 from teams t where t.id = team_members.team_id
    and has_role(t.organization_id, array['admin','event_director']::user_role[])));

create policy "org staff manage registrations" on registrations for all
  using (exists (select 1 from events e where e.id = registrations.event_id
    and has_role(e.organization_id, array['admin','event_director']::user_role[])));

create policy "org staff manage wods" on wods for all
  using (exists (select 1 from events e where e.id = wods.event_id
    and has_role(e.organization_id, array['admin','event_director']::user_role[])));

create policy "org staff manage heats" on heats for all
  using (exists (select 1 from events e where e.id = heats.event_id
    and has_role(e.organization_id, array['admin','event_director','production_director']::user_role[])));

create policy "org staff manage lanes" on lanes for all
  using (exists (select 1 from heats h join events e on e.id = h.event_id
    where h.id = lanes.heat_id
    and has_role(e.organization_id, array['admin','event_director']::user_role[])));

-- Scoring operators enter/edit raw results; admins/event directors can too.
create policy "scoring staff manage results" on results for all
  using (exists (select 1 from heats h join events e on e.id = h.event_id
    where h.id = results.heat_id
    and has_role(e.organization_id,
      array['admin','event_director','scoring_operator']::user_role[])));

create policy "org staff manage standings" on standings for all
  using (exists (select 1 from events e where e.id = standings.event_id
    and has_role(e.organization_id, array['admin','event_director','scoring_operator']::user_role[])));

create policy "org staff manage sponsors" on sponsors for all
  using (has_role(organization_id, array['admin','event_director']::user_role[]));

-- Production directors drive broadcast_state; admins/event directors can too.
create policy "production staff manage broadcast_state" on broadcast_state for all
  using (exists (select 1 from floors f join venues v on v.id = f.venue_id
    join events e on e.id = v.event_id
    where f.id = broadcast_state.floor_id
    and has_role(e.organization_id,
      array['admin','event_director','production_director']::user_role[])));

create policy "authenticated insert operator_actions" on operator_actions for insert
  with check (auth.uid() is not null);
create policy "org staff read operator_actions" on operator_actions for select
  using (exists (select 1 from events e where e.id = operator_actions.event_id
    and has_role(e.organization_id, array['admin','event_director','production_director']::user_role[])));

-- Users can read their own profile/roles; admins manage roles.
create policy "read own profile" on profiles for select using (id = auth.uid());
create policy "read own roles" on user_roles for select using (user_id = auth.uid());
create policy "admins manage roles" on user_roles for all
  using (has_role(organization_id, array['admin']::user_role[]));
create policy "admins read orgs" on organizations for select
  using (has_role(id, array['admin','event_director','scoring_operator','production_director','commentator']::user_role[]));

-- ---------------------------------------------------------------------------
-- Realtime: publish the tables clients subscribe to.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table broadcast_state;
alter publication supabase_realtime add table heats;
alter publication supabase_realtime add table lanes;
alter publication supabase_realtime add table results;
alter publication supabase_realtime add table standings;
