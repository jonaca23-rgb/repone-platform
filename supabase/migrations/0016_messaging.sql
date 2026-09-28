-- RepOne Platform — Athlete directory + direct messaging
--
-- Jonathan asked for: (1) an athlete's own profile page to show other
-- athletes' info, (2) a messaging system so an athlete can message another
-- athlete or an admin/staff member (and staff can message an athlete back),
-- (3) a place to read messages from either an athlete or staff, and (4) a
-- live notification badge when a new message arrives.
--
-- One flat `messages` table keyed on auth.users ids covers every direction
-- (athlete<->athlete, athlete<->staff) because both identity spaces already
-- share the same auth.users table (see 0010_athlete_open_log.sql's
-- athletes.auth_user_id). `can_message()` is the single gate deciding which
-- sender/recipient pairs may exist at all: same-organization
-- athlete<->athlete, or an athlete<->any staff member who holds a role in
-- that athlete's organization. Staff<->staff is deliberately NOT allowed
-- through this table — it wasn't asked for, and staff already have other
-- ways to reach each other.

create table messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id),
  check (length(btrim(body)) > 0)
);

-- Inbox list ("my most recent messages") and unread-count queries both filter
-- on recipient_id; the sender_id index is the mirror for "messages I sent."
create index on messages (recipient_id, created_at desc);
create index on messages (sender_id, created_at desc);
-- One conversation thread: both directions between the same two people.
create index on messages (sender_id, recipient_id, created_at);

create or replace function can_message(p_sender uuid, p_recipient uuid) returns boolean as $$
  select p_sender <> p_recipient and (
    -- both are athletes in the same organization
    exists (
      select 1 from athletes s join athletes r on r.organization_id = s.organization_id
      where s.auth_user_id = p_sender and r.auth_user_id = p_recipient
    )
    -- sender is an athlete, recipient holds a staff role in that athlete's org
    or exists (
      select 1 from athletes s join user_roles ur on ur.organization_id = s.organization_id
      where s.auth_user_id = p_sender and ur.user_id = p_recipient
    )
    -- sender holds a staff role, recipient is an athlete in that org
    or exists (
      select 1 from athletes r join user_roles ur on ur.organization_id = r.organization_id
      where r.auth_user_id = p_recipient and ur.user_id = p_sender
    )
  );
$$ language sql stable security definer set search_path = public;

grant execute on function can_message(uuid, uuid) to authenticated;

alter table messages enable row level security;

create policy "participants read own messages" on messages for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "send allowed messages" on messages for insert
  with check (auth.uid() = sender_id and can_message(sender_id, recipient_id));

-- Only the recipient marks a message read, and the app layer (markThreadRead
-- in lib/actions/messages.ts) only ever touches read_at — same trust level
-- as the rest of this codebase's RLS, which doesn't do column-level checks.
create policy "recipient marks own messages read" on messages for update
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- ---------------------------------------------------------------------------
-- Athletes need to see their own organization's staff directory to start a
-- conversation with an admin/event director/etc. `profiles`/`user_roles`
-- previously only let a signed-in user read their OWN row (see
-- 0002_rls_and_realtime.sql) — this adds read access to the other side.
-- ---------------------------------------------------------------------------

create policy "athlete read org staff profiles" on profiles for select
  using (exists (
    select 1 from athletes a join user_roles ur on ur.organization_id = a.organization_id
    where a.auth_user_id = auth.uid() and ur.user_id = profiles.id
  ));

create policy "athlete read org staff roles" on user_roles for select
  using (exists (
    select 1 from athletes a where a.auth_user_id = auth.uid() and a.organization_id = user_roles.organization_id
  ));

-- ---------------------------------------------------------------------------
-- Column-level lockdown: `athletes` has been public-read (RLS `using (true)`)
-- since 0002_rls_and_realtime.sql so overlays/leaderboards can render with no
-- auth at all. That was fine while every column on the table was
-- broadcast-safe. This messaging feature is the first thing to read
-- auth_user_id (to resolve who to message) and date_of_birth (to compute an
-- age category for another athlete's profile, never to display the raw date
-- — see the athlete directory profile page). Neither belongs in front of an
-- anonymous overlay viewer, so this revokes those two columns from the
-- `anon` role specifically while leaving them selectable by `authenticated`
-- (signed-in staff and athletes) — every existing anonymous page already
-- selects neither column, so this changes no current behavior.
-- ---------------------------------------------------------------------------

revoke select (auth_user_id, date_of_birth) on table athletes from anon;

alter publication supabase_realtime add table messages;
