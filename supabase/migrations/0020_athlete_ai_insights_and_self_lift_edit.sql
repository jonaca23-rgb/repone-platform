-- RepOne Platform — Athlete self-service lift editing + private AI insights
--
-- Jonathan asked that an athlete's own dashboard show their lifts/times, an
-- AI-generated strengths/weaknesses analysis of that data ("This will only
-- be visible to him" — a stricter privacy bar than any other feature in this
-- app, so it gets its own dedicated table and an owner-only RLS policy, no
-- staff/org-member access at all), and that the athlete be able to update
-- their own lifts for new PRs/times, with the analysis regenerating after.
--
-- Two independent pieces:
--   1. Additive RLS letting an athlete manage (insert/update/delete) their
--      OWN athlete_lifts/athlete_benchmarks rows, alongside the existing
--      staff-only "manage" policies from 0004_athlete_extras.sql. RLS SELECT
--      *and* ALL policies are OR'd together, so this only ever widens who
--      can write, never narrows staff's existing access.
--   2. A new athlete_ai_insights table (one row per athlete) plus a
--      security-definer upsert function the app calls after a lift/benchmark
--      save, so the analysis text itself is never written directly by the
--      client — only by a function that has independently verified the
--      caller owns that athlete row.

-- ---------------------------------------------------------------------------
-- 1. Athlete self-service lift/benchmark writes.
-- ---------------------------------------------------------------------------

create policy "athlete manage own lifts" on athlete_lifts for all
  using (exists (select 1 from athletes a where a.id = athlete_lifts.athlete_id and a.auth_user_id = auth.uid()))
  with check (exists (select 1 from athletes a where a.id = athlete_lifts.athlete_id and a.auth_user_id = auth.uid()));

create policy "athlete manage own benchmarks" on athlete_benchmarks for all
  using (exists (select 1 from athletes a where a.id = athlete_benchmarks.athlete_id and a.auth_user_id = auth.uid()))
  with check (exists (select 1 from athletes a where a.id = athlete_benchmarks.athlete_id and a.auth_user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 2. AI-generated insights — owner-only, full stop. Unlike every other
-- athlete-data table in this app (which is org-member or staff readable),
-- there is deliberately no policy here for staff or other org members: the
-- only select policy checks the row's own auth_user_id against the caller.
-- ---------------------------------------------------------------------------

create table athlete_ai_insights (
  athlete_id uuid primary key references athletes(id) on delete cascade,
  summary text not null,
  strengths text[] not null default '{}',
  weaknesses text[] not null default '{}',
  model text not null,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger athlete_ai_insights_set_updated_at before update on athlete_ai_insights
  for each row execute function set_updated_at();

alter table athlete_ai_insights enable row level security;

create policy "athlete read own ai insights" on athlete_ai_insights for select
  using (exists (select 1 from athletes a where a.id = athlete_ai_insights.athlete_id and a.auth_user_id = auth.uid()));

-- No insert/update/delete policy at all — every write goes through the
-- security-definer function below, which re-checks ownership itself rather
-- than relying on a `with check` an authenticated client could otherwise
-- reach directly with a `.upsert()` call.

create or replace function upsert_athlete_ai_insights(
  p_athlete_id uuid,
  p_summary text,
  p_strengths text[],
  p_weaknesses text[],
  p_model text
) returns void as $$
begin
  if not exists (select 1 from athletes a where a.id = p_athlete_id and a.auth_user_id = auth.uid()) then
    raise exception 'Not authorized to update insights for this athlete';
  end if;

  insert into athlete_ai_insights (athlete_id, summary, strengths, weaknesses, model, generated_at, updated_at)
  values (p_athlete_id, p_summary, p_strengths, p_weaknesses, p_model, now(), now())
  on conflict (athlete_id) do update set
    summary = excluded.summary,
    strengths = excluded.strengths,
    weaknesses = excluded.weaknesses,
    model = excluded.model,
    generated_at = excluded.generated_at,
    updated_at = now();
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function upsert_athlete_ai_insights(uuid, text, text[], text[], text) to authenticated;
