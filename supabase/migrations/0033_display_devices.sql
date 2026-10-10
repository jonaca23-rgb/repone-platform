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

-- The player reloads its snapshot when any of these change.
do $$
declare t text;
begin
  foreach t in array array['display_devices','display_blocks','event_sponsorships',
                           'sponsor_creatives','sponsor_packages','sponsors'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
