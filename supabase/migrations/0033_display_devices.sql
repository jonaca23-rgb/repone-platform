-- ---------------------------------------------------------------------------
-- 0033 — Venue display devices (docs/specs/venue-display.md "Multiple displays", MVP: one)
--
-- A display device is one physical screen, bound to an event and the floor
-- whose broadcast_state it follows. display_blocks are its info-block
-- settings; sponsor frequency comes from event_sponsorships (0032).
-- ---------------------------------------------------------------------------

create type display_block_type as enum ('current_heat', 'next_heat', 'leaderboard');

create table display_devices (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  floor_id uuid not null references floors(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 100),
  enabled boolean not null default true,
  sponsors_enabled boolean not null default true,
  info_blocks_between_sponsors int not null default 1 check (info_blocks_between_sponsors between 1 and 5),
  -- Bumped whenever the event's sponsors change (see bump_display_content).
  content_version int not null default 0,
  created_at timestamptz not null default now()
);
create index on display_devices (event_id);

-- The floor must belong to the event.
create or replace function check_display_floor() returns trigger as $$
begin
  if not exists (select 1 from floors f join venues v on v.id = f.venue_id
                 where f.id = new.floor_id and v.event_id = new.event_id) then
    raise exception 'display_floor_event: floor % is not part of event %', new.floor_id, new.event_id;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
create trigger display_devices_floor_check before insert or update of floor_id, event_id on display_devices
  for each row execute function check_display_floor();

create table display_blocks (
  display_id uuid not null references display_devices(id) on delete cascade,
  block_type display_block_type not null,
  enabled boolean not null default true,
  duration_seconds int not null check (duration_seconds between 5 and 60),
  weight int not null default 1 check (weight between 1 and 10),
  primary key (display_id, block_type)
);

create or replace function create_default_display_blocks() returns trigger as $$
begin
  insert into display_blocks (display_id, block_type, duration_seconds, weight) values
    (new.id, 'current_heat', 15, 2),
    (new.id, 'next_heat', 12, 1),
    (new.id, 'leaderboard', 15, 2);
  return new;
end;
$$ language plpgsql security definer set search_path = public;
create trigger display_devices_default_blocks after insert on display_devices
  for each row execute function create_default_display_blocks();

-- Org managers and the event's assigned producers manage displays.
create or replace function can_manage_event_displays(p_event_id uuid) returns boolean as $$
  select exists (
    select 1 from events e where e.id = p_event_id
      and (has_role(e.organization_id, array['admin','event_director','production_director']::user_role[])
           or is_event_producer(e.id))
  );
$$ language sql stable security definer set search_path = public;
revoke execute on function can_manage_event_displays(uuid) from public, anon;
grant execute on function can_manage_event_displays(uuid) to authenticated;

alter table display_devices enable row level security;
alter table display_blocks enable row level security;

-- The kiosk is signed out; device rows carry no secrets (keys arrive with Part C).
create policy "public read display_devices" on display_devices for select using (true);
create policy "public read display_blocks" on display_blocks for select using (true);

create policy "event displays managers manage display_devices" on display_devices for all
  using (can_manage_event_displays(event_id)) with check (can_manage_event_displays(event_id));
create policy "event displays managers manage display_blocks" on display_blocks for all
  using (exists (select 1 from display_devices d where d.id = display_blocks.display_id
    and can_manage_event_displays(d.event_id)))
  with check (exists (select 1 from display_devices d where d.id = display_blocks.display_id
    and can_manage_event_displays(d.event_id)));

-- A signed-out kiosk can't hear sponsor changes itself: Realtime checks RLS
-- on the new row, so a sponsorship, sponsor or creative switched off becomes
-- invisible to it and the change is never delivered. Instead every change
-- that affects what an event's displays rotate bumps their content_version,
-- a row the kiosk can always read, and the player re-reads its snapshot.
create or replace function bump_display_content(p_event_ids uuid[]) returns void as $$
  update display_devices set content_version = content_version + 1
  where event_id = any(p_event_ids);
$$ language sql security definer set search_path = public;
revoke execute on function bump_display_content(uuid[]) from public, anon, authenticated;

create or replace function display_content_from_sponsorship() returns trigger as $$
begin
  perform bump_display_content(array[coalesce(new.event_id, old.event_id)]);
  return null;
end;
$$ language plpgsql security definer set search_path = public;
create trigger event_sponsorships_display_content
  after insert or update or delete on event_sponsorships
  for each row execute function display_content_from_sponsorship();

create or replace function display_content_from_sponsor() returns trigger as $$
begin
  perform bump_display_content(array(
    select event_id from event_sponsorships where sponsor_id = coalesce(new.id, old.id)));
  return null;
end;
$$ language plpgsql security definer set search_path = public;
create trigger sponsors_display_content
  after update or delete on sponsors
  for each row execute function display_content_from_sponsor();

create or replace function display_content_from_package() returns trigger as $$
begin
  perform bump_display_content(array(
    select event_id from event_sponsorships where package_id = coalesce(new.id, old.id)));
  return null;
end;
$$ language plpgsql security definer set search_path = public;
create trigger sponsor_packages_display_content
  after update on sponsor_packages
  for each row execute function display_content_from_package();

create or replace function display_content_from_creative() returns trigger as $$
begin
  perform bump_display_content(array(
    select event_id from event_sponsorships where sponsor_id = coalesce(new.sponsor_id, old.sponsor_id)));
  return null;
end;
$$ language plpgsql security definer set search_path = public;
create trigger sponsor_creatives_display_content
  after insert or update or delete on sponsor_creatives
  for each row execute function display_content_from_creative();

-- The player watches its own device row (settings and content_version) and
-- its blocks; deletes aren't filterable in Realtime, so it also re-reads
-- once a minute.
alter publication supabase_realtime add table display_devices;
alter publication supabase_realtime add table display_blocks;
