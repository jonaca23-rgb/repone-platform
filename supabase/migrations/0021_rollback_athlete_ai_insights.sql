-- RepOne Platform — Roll back the athlete AI insights feature
--
-- Jonathan asked to roll back the AI-generated strengths/weaknesses feature
-- and its self-service lift/benchmark editing
-- (0020_athlete_ai_insights_and_self_lift_edit.sql) after running into
-- Turbopack/OneDrive issues on his machine (unrelated to this feature's own
-- code, but he wants a clean rollback point regardless). This undoes exactly
-- what 0020 added, in reverse order, and nothing else:
--   - the athlete_ai_insights table (and its trigger/policy, dropped along
--     with it) and the upsert_athlete_ai_insights() function
--   - the two additive "athlete manage own lifts/benchmarks" policies, which
--     leaves athlete_lifts/athlete_benchmarks exactly as 0017 left them
--     (staff-manage, org-member-read — no athlete self-write)
--
-- 0020 itself is left in place in migration history rather than edited —
-- rerunning the full migration set from scratch on a fresh database now
-- means 0020 creates this feature and 0021 immediately undoes it, which
-- correctly nets out to "never had this feature," matching a database that
-- has run both.

drop function if exists upsert_athlete_ai_insights(uuid, text, text[], text[], text);

drop table if exists athlete_ai_insights;

drop policy if exists "athlete manage own lifts" on athlete_lifts;
drop policy if exists "athlete manage own benchmarks" on athlete_benchmarks;
