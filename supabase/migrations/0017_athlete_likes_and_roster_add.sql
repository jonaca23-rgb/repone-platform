-- RepOne Platform — Athlete-to-athlete lift/benchmark visibility, likes, and
-- self-service roster additions
--
-- Jonathan asked for the athlete portal's "Athletes" section to offer three
-- things: adding a new athlete to the roster, searching/browsing athletes
-- (their lift info and WOD position history), and messaging — with a "like"
-- action on another athlete's result or lift info, and all of it (likes +
-- messages) surfacing on the athlete's own personal dashboard alongside
-- their current leaderboard status.
--
-- This closes an open item flagged in 0016_messaging.sql: lift PRs and
-- benchmark times were deliberately left staff-only there because nothing
-- public showed them yet. Jonathan has now explicitly asked for other
-- athletes to see them, so this migration widens read access — deliberately,
-- not incidentally — via a new, additive policy on each table. The existing
-- staff-only policies are untouched; RLS SELECT policies are OR'd together,
-- so this only ever widens who can read, never narrows staff's own access.

-- ---------------------------------------------------------------------------
-- can_like() — the single gate on who may see/create a like: an athlete or
-- staff member who belongs to the SAME organization as the athlete whose
-- content is being liked. Mirrors can_message()'s membership logic
-- (0016_messaging.sql) but checks org membership generally rather than a
-- specific sender/recipient pair, since a like's "recipient" is an athlete
-- row, not a specific auth user.
-- ---------------------------------------------------------------------------

create or replace function can_like(p_liker uuid, p_athlete_id uuid) returns boolean as $$
  select exists (
    select 1 from athletes target
    where target.id = p_athlete_id
      and (
        exists (select 1 from athletes s where s.auth_user_id = p_liker and s.organization_id = target.organization_id)
        or exists (select 1 from user_roles ur where ur.user_id = p_liker and ur.organization_id = target.organization_id)
      )
  );
$$ language sql stable security definer set search_path = public;

grant execute on function can_like(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Widen athlete_lifts / athlete_benchmarks reads to any org member, not just
-- staff (0004_athlete_extras.sql's original policies stay as-is for staff).
-- ---------------------------------------------------------------------------

create policy "org members read athlete_lifts" on athlete_lifts for select
  using (can_like(auth.uid(), athlete_lifts.athlete_id));

create policy "org members read athlete_benchmarks" on athlete_benchmarks for select
  using (can_like(auth.uid(), athlete_benchmarks.athlete_id));

-- ---------------------------------------------------------------------------
-- Likes — one row per (liker, target). `target_id` points at whichever
-- table `target_type` names (athlete_lifts.id, athlete_benchmarks.id, or
-- standings.id); it's polymorphic so no single FK constraint can cover it —
-- the app layer (lib/actions/social.ts) is the one place that ever writes
-- target_id, and always alongside a target_type/athlete_id it just read
-- from that same row, so the three always agree in practice. This is the
-- same "trusted at the app layer, not trigger-enforced" trade-off this
-- codebase already makes for payment_line_items' amount sum
-- (0007_payments_and_teams.sql).
-- ---------------------------------------------------------------------------

create type like_target_type as enum ('lift', 'benchmark', 'standing');

create table athlete_likes (
  id uuid primary key default gen_random_uuid(),
  liker_user_id uuid not null references auth.users(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade, -- whose content this is — denormalized so "likes I received" needs no join through 3 different target tables
  target_type like_target_type not null,
  target_id uuid not null,
  created_at timestamptz not null default now(),
  unique (liker_user_id, target_type, target_id)
);

create index on athlete_likes (athlete_id, created_at desc);

alter table athlete_likes enable row level security;

create policy "org members read likes" on athlete_likes for select
  using (can_like(auth.uid(), athlete_id));

create policy "org members create own likes" on athlete_likes for insert
  with check (liker_user_id = auth.uid() and can_like(auth.uid(), athlete_id));

create policy "members remove own likes" on athlete_likes for delete
  using (liker_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- "Add New Athlete" from the athlete portal — any onboarded athlete can add
-- a bare roster entry (name/affiliate) to their OWN organization, same as
-- staff's existing Add Athlete form, but insert-only: an athlete can create
-- a new athletes row but can't update or delete an existing one (that stays
-- "org staff manage athletes"-only, 0002_rls_and_realtime.sql). Note this
-- does not link to that person's own eventual signup — if they later create
-- their own RepOne account (0010_athlete_open_log.sql's bootstrap_athlete),
-- that creates a SEPARATE athletes row rather than claiming this one, since
-- bootstrap_athlete has no way to search for and match an existing
-- unlinked roster entry by name. Worth a follow-up if duplicate athlete
-- rows from this become a real problem in practice.
-- ---------------------------------------------------------------------------

create policy "athlete add org roster athlete" on athletes for insert
  with check (exists (
    select 1 from athletes a where a.auth_user_id = auth.uid() and a.organization_id = athletes.organization_id
  ));
