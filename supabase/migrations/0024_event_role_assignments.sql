-- RepOne Platform — Event-scoped Scorekeeper/Producer/Commentator assignments
--
-- Per Jonathan's RBAC spec (see architecture/rbac-audit-and-plan.md in the
-- RepOneLive project): Scorekeeper, Producer, and Commentator are NOT
-- org-wide roles the way Admin is. Each is assigned per event, and only
-- has access to the event(s) they're assigned to. The existing
-- `user_roles` enum values `scoring_operator`/`production_director`/
-- `commentator` (0001_init.sql) were org-wide and are left untouched —
-- unused going forward, not deleted, per this project's migration-history
-- convention — in favor of the three assignment tables below, which match
-- the shape Jonathan specified.
--
-- `admin` is unaffected by any of this: an admin already has unrestricted
-- access to every event via the existing `has_role()`-based policies, and
-- every policy added below is additive (OR'd with what already exists).

-- ---------------------------------------------------------------------------
-- Shared assignment status
-- ---------------------------------------------------------------------------

create type event_assignment_status as enum ('active', 'inactive', 'removed');

-- ---------------------------------------------------------------------------
-- Scorekeeper assignments
-- ---------------------------------------------------------------------------

create table event_scorekeeper_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  scorekeeper_user_id uuid not null references auth.users(id) on delete cascade,
  assigned_by_admin_id uuid references auth.users(id),
  status event_assignment_status not null default 'active',
  assigned_at timestamptz not null default now(),
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, scorekeeper_user_id)
);

create index on event_scorekeeper_assignments (event_id, status);

-- ---------------------------------------------------------------------------
-- Producer assignments
-- ---------------------------------------------------------------------------

create table event_producer_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  producer_user_id uuid not null references auth.users(id) on delete cascade,
  assigned_by_admin_id uuid references auth.users(id),
  status event_assignment_status not null default 'active',
  assigned_at timestamptz not null default now(),
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, producer_user_id)
);

create index on event_producer_assignments (event_id, status);

-- ---------------------------------------------------------------------------
-- Commentator assignments — the only one of the three with a role_label,
-- per Jonathan's spec (main_commentator / co_commentator / sideline_reporter
-- / interviewer). Free text rather than an enum: these are display labels
-- with no permission difference between them today, so a typo doesn't need
-- a migration to fix, unlike a real permission-bearing enum value would.
-- ---------------------------------------------------------------------------

create table event_commentator_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  commentator_user_id uuid not null references auth.users(id) on delete cascade,
  assigned_by_admin_id uuid references auth.users(id),
  role_label text,
  status event_assignment_status not null default 'active',
  assigned_at timestamptz not null default now(),
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, commentator_user_id)
);

create index on event_commentator_assignments (event_id, status);

-- ---------------------------------------------------------------------------
-- RLS: enable + admin-manages / assignee-reads-own-row, same shape x3
-- ---------------------------------------------------------------------------

alter table event_scorekeeper_assignments enable row level security;
alter table event_producer_assignments enable row level security;
alter table event_commentator_assignments enable row level security;

create policy "admins manage scorekeeper assignments" on event_scorekeeper_assignments for all
  using (exists (select 1 from events e where e.id = event_scorekeeper_assignments.event_id
    and has_role(e.organization_id, array['admin']::user_role[])))
  with check (exists (select 1 from events e where e.id = event_scorekeeper_assignments.event_id
    and has_role(e.organization_id, array['admin']::user_role[])));

create policy "assignee reads own scorekeeper assignment" on event_scorekeeper_assignments for select
  using (scorekeeper_user_id = auth.uid());

create policy "admins manage producer assignments" on event_producer_assignments for all
  using (exists (select 1 from events e where e.id = event_producer_assignments.event_id
    and has_role(e.organization_id, array['admin']::user_role[])))
  with check (exists (select 1 from events e where e.id = event_producer_assignments.event_id
    and has_role(e.organization_id, array['admin']::user_role[])));

create policy "assignee reads own producer assignment" on event_producer_assignments for select
  using (producer_user_id = auth.uid());

create policy "admins manage commentator assignments" on event_commentator_assignments for all
  using (exists (select 1 from events e where e.id = event_commentator_assignments.event_id
    and has_role(e.organization_id, array['admin']::user_role[])))
  with check (exists (select 1 from events e where e.id = event_commentator_assignments.event_id
    and has_role(e.organization_id, array['admin']::user_role[])));

create policy "assignee reads own commentator assignment" on event_commentator_assignments for select
  using (commentator_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- has_role()-style helpers for the three assignment tables — used the same
-- way has_role() is used throughout 0002_rls_and_realtime.sql, just keyed by
-- event instead of organization.
-- ---------------------------------------------------------------------------

create or replace function is_event_scorekeeper(p_event_id uuid) returns boolean as $$
  select exists (
    select 1 from event_scorekeeper_assignments a
    where a.event_id = p_event_id and a.scorekeeper_user_id = auth.uid() and a.status = 'active'
  );
$$ language sql stable security definer set search_path = public;

create or replace function is_event_producer(p_event_id uuid) returns boolean as $$
  select exists (
    select 1 from event_producer_assignments a
    where a.event_id = p_event_id and a.producer_user_id = auth.uid() and a.status = 'active'
  );
$$ language sql stable security definer set search_path = public;

create or replace function is_event_commentator(p_event_id uuid) returns boolean as $$
  select exists (
    select 1 from event_commentator_assignments a
    where a.event_id = p_event_id and a.commentator_user_id = auth.uid() and a.status = 'active'
  );
$$ language sql stable security definer set search_path = public;

grant execute on function is_event_scorekeeper(uuid) to authenticated;
grant execute on function is_event_producer(uuid) to authenticated;
grant execute on function is_event_commentator(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Additive widening: an assigned Scorekeeper/Producer can now write to the
-- tables their job requires, scoped to their own assigned event, alongside
-- (never instead of) the existing org-wide admin/event_director access.
-- Commentator needs no additional grants here — heats/lanes/results/
-- standings/wods/athletes/broadcast_state are already public-read
-- (0002_rls_and_realtime.sql), which already covers everything a read-only
-- Commentator needs; only the UI-level assignment check (§ the app layer)
-- decides what a commentator screen shows them.
-- ---------------------------------------------------------------------------

create policy "event scorekeeper manage heats" on heats for all
  using (is_event_scorekeeper(heats.event_id));

create policy "event scorekeeper manage lanes" on lanes for all
  using (exists (select 1 from heats h where h.id = lanes.heat_id and is_event_scorekeeper(h.event_id)));

create policy "event scorekeeper manage results" on results for all
  using (exists (select 1 from heats h where h.id = results.heat_id and is_event_scorekeeper(h.event_id)));

create policy "event scorekeeper manage standings" on standings for all
  using (is_event_scorekeeper(standings.event_id));

create policy "event producer manage heats" on heats for all
  using (is_event_producer(heats.event_id));

create policy "event producer manage lanes" on lanes for all
  using (exists (select 1 from heats h where h.id = lanes.heat_id and is_event_producer(h.event_id)));

create policy "event producer manage results" on results for all
  using (exists (select 1 from heats h where h.id = results.heat_id and is_event_producer(h.event_id)));

create policy "event producer manage standings" on standings for all
  using (is_event_producer(standings.event_id));

create policy "event producer manage broadcast_state" on broadcast_state for all
  using (exists (select 1 from floors f join venues v on v.id = f.venue_id
    where f.id = broadcast_state.floor_id and is_event_producer(v.event_id)));

create policy "event producer read operator_actions" on operator_actions for select
  using (is_event_producer(operator_actions.event_id));

-- A producer can edit (not create/delete) the event they're assigned to —
-- "Producer can edit event details" per spec, scoped to just their event.
create policy "event producer update own event" on events for update
  using (is_event_producer(events.id))
  with check (is_event_producer(events.id));
