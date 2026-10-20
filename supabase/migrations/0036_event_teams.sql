-- ---------------------------------------------------------------------------
-- 0036 — Teams belong to events
--
-- A team used to belong to the organization and join events through a
-- registration, with its format and size on the team. Now a division says
-- whether it is for individuals or teams and how many athletes a team has;
-- a team is created inside one event, in one of its team divisions, from the
-- organization's athletes; and an athlete is on at most one team per event.
-- The team keeps one registration row, which is what its fee is paid on.
--
-- The project is not live: existing teams are dropped, not carried over.
-- Trigger messages start with a tag the app maps to a readable refusal.
-- ---------------------------------------------------------------------------

-- Divisions say what competes in them -------------------------------------
alter table divisions
  add column entry_format competitor_entry_type not null default 'individual',
  add column team_size int,
  add constraint divisions_format_size_check check (
    (entry_format = 'individual' and team_size is null)
    or (entry_format = 'pair' and team_size is not null and team_size = 2)
    or (entry_format in ('team', 'custom') and team_size is not null and team_size between 2 and 20)
  );

-- Teams move into an event and a division ----------------------------------
drop policy if exists "org staff manage teams" on teams;
drop policy if exists "org staff manage team_members" on team_members;

delete from teams;

alter table teams
  drop column organization_id,
  drop column entry_format,
  drop column team_size,
  add column event_id uuid not null references events(id) on delete cascade,
  add column division_id uuid not null references divisions(id) on delete cascade,
  add column captain_athlete_id uuid references athletes(id) on delete set null;

-- The team-only format enum went with teams.entry_format; divisions use
-- competitor_entry_type, which also has "individual".
drop type entry_format;

create index on teams (event_id);
create unique index teams_event_name_key on teams (event_id, lower(btrim(name)));

alter table team_members
  add column event_id uuid not null references events(id) on delete cascade,
  add constraint team_members_event_athlete_key unique (event_id, athlete_id);

create or replace function guard_team() returns trigger as $$
declare
  v_event uuid;
  v_format competitor_entry_type;
begin
  -- A team stays where it was created: its registration, heats and results
  -- are in that division.
  if tg_op = 'UPDATE' and (new.division_id is distinct from old.division_id
                           or new.event_id is distinct from old.event_id) then
    raise exception 'team_division_fixed: a team stays in the division it was created in';
  end if;
  select event_id, entry_format into v_event, v_format from divisions where id = new.division_id;
  if v_event is distinct from new.event_id then
    raise exception 'team_division_event: that division is not part of this event';
  end if;
  if v_format = 'individual' then
    raise exception 'team_division_individual: that division is for individuals';
  end if;
  if new.captain_athlete_id is not null and not exists (
    select 1 from team_members where team_id = new.id and athlete_id = new.captain_athlete_id
  ) then
    raise exception 'team_captain_not_member: the captain must be on the roster';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger teams_guard
  before insert or update of event_id, division_id, captain_athlete_id on teams
  for each row execute function guard_team();

-- Creating a team registers it, in the same statement: a team never exists
-- without the registration its fee, heats and payments hang from.
create or replace function register_new_team() returns trigger as $$
begin
  insert into registrations (event_id, division_id, team_id)
  values (new.event_id, new.division_id, new.id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger teams_register
  after insert on teams
  for each row execute function register_new_team();

-- A member row carries its team's event, so "one team per athlete per event"
-- is a unique constraint. The size check locks the team so two adds of the
-- last spot can't both pass.
create or replace function guard_team_member() returns trigger as $$
declare
  v_event uuid;
  v_org uuid;
  v_size int;
  v_count int;
begin
  select t.event_id, e.organization_id, d.team_size
    into v_event, v_org, v_size
  from teams t
    join events e on e.id = t.event_id
    join divisions d on d.id = t.division_id
  where t.id = new.team_id;
  new.event_id := v_event;

  if not exists (select 1 from athletes a where a.id = new.athlete_id and a.organization_id = v_org) then
    raise exception 'team_member_org: that athlete is not part of this organization';
  end if;
  if exists (
    select 1 from team_members m
    where m.event_id = v_event and m.athlete_id = new.athlete_id and m.team_id <> new.team_id
  ) then
    raise exception 'team_member_other_team: that athlete is already on another team in this event'
      using errcode = '23505';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('team:' || new.team_id::text, 0));
  select count(*) into v_count from team_members where team_id = new.team_id;
  if v_count >= v_size then
    raise exception 'team_full: this team already has % of % members', v_count, v_size;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger team_members_guard
  before insert on team_members
  for each row execute function guard_team_member();

-- Members are added and removed, never edited: an update would skip every
-- check above.
create or replace function refuse_team_member_update() returns trigger as $$
begin
  raise exception 'team_member_fixed: remove the member and add them again instead';
end;
$$ language plpgsql set search_path = public;

create trigger team_members_no_update
  before update on team_members
  for each row execute function refuse_team_member_update();

-- A captain who leaves the roster stops being captain.
create or replace function clear_departed_captain() returns trigger as $$
begin
  update teams set captain_athlete_id = null
  where id = old.team_id and captain_athlete_id = old.athlete_id;
  return old;
end;
$$ language plpgsql security definer set search_path = public;

create trigger team_members_clear_captain
  after delete on team_members
  for each row execute function clear_departed_captain();

-- A registration matches its division: athletes in individual divisions,
-- teams in team divisions, and a team only in its own event and division.
create or replace function guard_registration_kind() returns trigger as $$
declare
  v_format competitor_entry_type;
begin
  select entry_format into v_format from divisions where id = new.division_id;
  if new.athlete_id is not null and v_format <> 'individual' then
    raise exception 'registration_kind: that division is for teams';
  end if;
  if new.team_id is not null then
    if v_format = 'individual' then
      raise exception 'registration_kind: that division is for individuals';
    end if;
    if not exists (
      select 1 from teams t
      where t.id = new.team_id and t.event_id = new.event_id and t.division_id = new.division_id
    ) then
      raise exception 'registration_team_mismatch: a team registers in its own event and division';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger registrations_guard_kind
  before insert or update of event_id, division_id, athlete_id, team_id on registrations
  for each row execute function guard_registration_kind();

-- A division's format is fixed once anyone is in it: athletes and teams
-- registered under one format can't be reinterpreted as the other.
create or replace function guard_division_format() returns trigger as $$
begin
  if new.entry_format is distinct from old.entry_format
     or new.team_size is distinct from old.team_size then
    if exists (select 1 from registrations where division_id = new.id)
       or exists (select 1 from teams where division_id = new.id) then
      raise exception 'division_format_locked: this division already has registrations';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger divisions_guard_format
  before update of entry_format, team_size on divisions
  for each row execute function guard_division_format();

-- RLS ------------------------------------------------------------------------
-- Reads stay public (the live page and the overlays run signed out). The
-- event's organizers write; floor staff and athletes don't.
create policy "event organizers manage teams" on teams for all
  using (exists (
    select 1 from events e where e.id = teams.event_id
      and has_role(e.organization_id, array['admin','event_director']::user_role[])))
  with check (exists (
    select 1 from events e where e.id = teams.event_id
      and has_role(e.organization_id, array['admin','event_director']::user_role[])));

create policy "event organizers manage team_members" on team_members for all
  using (exists (
    select 1 from teams t join events e on e.id = t.event_id
    where t.id = team_members.team_id
      and has_role(e.organization_id, array['admin','event_director']::user_role[])))
  with check (exists (
    select 1 from teams t join events e on e.id = t.event_id
    where t.id = team_members.team_id
      and has_role(e.organization_id, array['admin','event_director']::user_role[])));
