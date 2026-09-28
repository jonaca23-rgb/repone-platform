-- RepOne Platform — Restore athlete self-service lift/benchmark editing
--
-- Jonathan asked that the athlete dashboard (/athlete) show the lifts and
-- workout times an athlete has entered, plus their results from any past
-- RepOne-managed event, and confirmed athletes should be able to enter/edit
-- their own lifts and times themselves (not just have staff enter them),
-- via an editable section on the dashboard.
--
-- This is exactly piece 1 of 0020_athlete_ai_insights_and_self_lift_edit.sql
-- (the self-service write policies), which 0021 dropped along with the
-- AI-insights half of that feature when Jonathan rolled that whole feature
-- back. The AI analysis piece is NOT being restored here — only the ability
-- for an athlete to manage their own athlete_lifts/athlete_benchmarks rows.
-- Re-adding the identical policy under a new migration (rather than
-- resurrecting 0020, which stays as a historical record of what shipped and
-- was rolled back) so the migration history reads truthfully in order.
--
-- Same additive-RLS shape as before: these are on top of the existing
-- staff-only "manage" policies from 0004_athlete_extras.sql. RLS ALL
-- policies are OR'd together, so this only ever widens who can write, never
-- narrows staff's existing access.

create policy "athlete manage own lifts" on athlete_lifts for all
  using (exists (select 1 from athletes a where a.id = athlete_lifts.athlete_id and a.auth_user_id = auth.uid()))
  with check (exists (select 1 from athletes a where a.id = athlete_lifts.athlete_id and a.auth_user_id = auth.uid()));

create policy "athlete manage own benchmarks" on athlete_benchmarks for all
  using (exists (select 1 from athletes a where a.id = athlete_benchmarks.athlete_id and a.auth_user_id = auth.uid()))
  with check (exists (select 1 from athletes a where a.id = athlete_benchmarks.athlete_id and a.auth_user_id = auth.uid()));
