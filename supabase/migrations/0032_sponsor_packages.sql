-- ---------------------------------------------------------------------------
-- 0032 — Sponsor packages, per-event sponsorships, creatives
--
-- A sponsor is one org-level record. What it bought for an event lives on
-- event_sponsorships (package + optional overrides), so the same sponsor can
-- buy a different level at each event (docs/specs/venue-display.md "Sponsor architecture").
-- Packages replace the sponsor_tier enum and are editable per org.
-- ---------------------------------------------------------------------------

create table sponsor_packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 100),
  display_enabled boolean not null default true,
  display_duration_seconds int not null default 10 check (display_duration_seconds between 3 and 60),
  display_weight int not null default 1 check (display_weight between 1 and 10),
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table event_sponsorships (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  sponsor_id uuid not null references sponsors(id) on delete cascade,
  package_id uuid not null references sponsor_packages(id) on delete restrict,
  category_exclusive boolean not null default false,
  display_duration_override int check (display_duration_override between 3 and 60),
  display_weight_override int check (display_weight_override between 1 and 10),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (event_id, sponsor_id)
);
create index on event_sponsorships (event_id) where active;

create table sponsor_creatives (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references sponsors(id) on delete cascade,
  storage_path text not null unique,
  public_url text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on sponsor_creatives (sponsor_id) where active;

-- Sponsors become org-level. Not in production: no rows to carry over.
drop index if exists sponsors_category_exclusive_uidx;
alter table sponsors
  drop column event_id,
  drop column tier,
  drop column category_exclusive,
  drop column commercial_video_url;
drop type sponsor_tier;

-- Default packages for every organization (the former tiers).
create or replace function create_default_sponsor_packages() returns trigger as $$
begin
  insert into sponsor_packages (organization_id, name, display_duration_seconds, display_weight, sort_order) values
    (new.id, 'Logo Sponsor',        10, 1, 0),
    (new.id, 'Brand Mention',       10, 1, 1),
    (new.id, 'Commercial 30',       10, 2, 2),
    (new.id, 'Commercial 30 Plus',  15, 3, 3),
    (new.id, 'WOD Sponsor',         15, 3, 4),
    (new.id, 'Presenting Sponsor',  20, 4, 5);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger organizations_default_sponsor_packages after insert on organizations
  for each row execute function create_default_sponsor_packages();

insert into sponsor_packages (organization_id, name, display_duration_seconds, display_weight, sort_order)
select o.id, p.name, p.d, p.w, p.s from organizations o
cross join (values ('Logo Sponsor',10,1,0),('Brand Mention',10,1,1),('Commercial 30',10,2,2),
  ('Commercial 30 Plus',15,3,3),('WOD Sponsor',15,3,4),('Presenting Sponsor',20,4,5)) as p(name,d,w,s)
on conflict do nothing;

-- One exclusive sponsor per category per event. The category lives on the
-- sponsor, so a partial unique index can't express it; a trigger can.
-- Categories compare case-insensitively. The advisory lock serializes two
-- concurrent inserts for the same (event, category).
create or replace function enforce_sponsor_category_exclusive() returns trigger as $$
declare
  v_category text;
begin
  if not new.active then return new; end if;
  select lower(btrim(category)) into v_category from sponsors where id = new.sponsor_id;
  if v_category is null or v_category = '' then return new; end if;
  perform pg_advisory_xact_lock(hashtext(new.event_id::text || ':' || v_category));
  if exists (
    select 1 from event_sponsorships es join sponsors s on s.id = es.sponsor_id
    where es.event_id = new.event_id and es.id <> new.id and es.active
      and lower(btrim(s.category)) = v_category
      and (es.category_exclusive or new.category_exclusive)
  ) then
    raise exception 'sponsor_category_exclusive: category "%" is exclusive for this event', v_category
      using errcode = '23505';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger event_sponsorships_category_exclusive
  before insert or update of active, category_exclusive, sponsor_id, event_id on event_sponsorships
  for each row execute function enforce_sponsor_category_exclusive();

-- RLS ----------------------------------------------------------------------
alter table sponsor_packages enable row level security;
alter table event_sponsorships enable row level security;
alter table sponsor_creatives enable row level security;

-- Public reads: the venue display and overlays run signed out.
-- Every package, active or not: switching a package off stops it being sold,
-- not the sponsorships that already use it from showing.
create policy "public read sponsor_packages" on sponsor_packages for select using (true);
create policy "public read active event_sponsorships" on event_sponsorships for select using (active);
create policy "public read active sponsor_creatives" on sponsor_creatives for select using (active);

create policy "org managers manage sponsor_packages" on sponsor_packages for all
  using (has_role(organization_id, array['admin','event_director']::user_role[]))
  with check (has_role(organization_id, array['admin','event_director']::user_role[]));

create policy "org managers manage event_sponsorships" on event_sponsorships for all
  using (exists (select 1 from events e where e.id = event_sponsorships.event_id
    and has_role(e.organization_id, array['admin','event_director']::user_role[])))
  with check (
    exists (select 1 from events e where e.id = event_sponsorships.event_id
      and has_role(e.organization_id, array['admin','event_director']::user_role[]))
    -- sponsor and package must belong to the event's org
    and exists (select 1 from events e join sponsors s on s.organization_id = e.organization_id
      join sponsor_packages p on p.organization_id = e.organization_id
      where e.id = event_sponsorships.event_id and s.id = event_sponsorships.sponsor_id
        and p.id = event_sponsorships.package_id));

create policy "org managers manage sponsor_creatives" on sponsor_creatives for all
  using (exists (select 1 from sponsors s where s.id = sponsor_creatives.sponsor_id
    and has_role(s.organization_id, array['admin','event_director']::user_role[])))
  with check (exists (select 1 from sponsors s where s.id = sponsor_creatives.sponsor_id
    and has_role(s.organization_id, array['admin','event_director']::user_role[])));

-- Event producers read their event's sponsorships even when inactive.
create policy "event producer read event_sponsorships" on event_sponsorships for select
  using (is_event_producer(event_id));

-- Storage: sponsor-creatives ------------------------------------------------
-- 4 MB cap: Vercel Functions reject request bodies over 4.5 MB, and uploads
-- go through a Server Action.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sponsor-creatives', 'sponsor-creatives', true, 4194304,
        array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

create or replace function can_manage_sponsor_creative(p_object_name text) returns boolean as $$
  select exists (
    select 1 from sponsors s
    where s.id::text = (storage.foldername(p_object_name))[1]
      and has_role(s.organization_id, array['admin','event_director']::user_role[])
  );
$$ language sql stable security definer set search_path = public;
revoke execute on function can_manage_sponsor_creative(text) from public, anon;
grant execute on function can_manage_sponsor_creative(text) to authenticated;

drop policy if exists "public read sponsor_creatives objects" on storage.objects;
create policy "public read sponsor_creatives objects" on storage.objects for select
  using (bucket_id = 'sponsor-creatives');
drop policy if exists "manage org sponsor_creatives objects" on storage.objects;
create policy "manage org sponsor_creatives objects" on storage.objects for all to authenticated
  using (bucket_id = 'sponsor-creatives' and can_manage_sponsor_creative(name))
  with check (bucket_id = 'sponsor-creatives' and can_manage_sponsor_creative(name));
