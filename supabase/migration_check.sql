-- RepOne Platform — migration status check (read-only, safe to run any time)
-- Paste this whole thing into the Supabase SQL Editor and run it. It checks
-- every migration file in supabase/migrations for a real, load-bearing
-- artifact (a column, table, constraint, trigger, or function that
-- migration adds) and reports true/false — no guessing from memory needed.

select '0001_init' as migration, exists (
  select 1 from information_schema.tables where table_schema='public' and table_name='heats'
) as applied
union all
select '0002_rls_and_realtime', exists (
  select 1 from pg_policies where schemaname='public' and tablename='events'
)
union all
select '0003_bootstrap', exists (
  select 1 from pg_proc where proname='bootstrap_organization'
)
union all
select '0004_athlete_extras', exists (
  select 1 from information_schema.columns where table_name='athletes' and column_name='date_of_birth'
)
union all
select '0005_athlete_photos_storage', exists (
  select 1 from storage.buckets where id='athlete-photos'
)
union all
select '0006_result_manual_adjustment', exists (
  select 1 from information_schema.columns where table_name='results' and column_name='manually_adjusted'
)
union all
select '0007_payments_and_teams', exists (
  select 1 from information_schema.columns where table_name='teams' and column_name='entry_format'
) and exists (
  select 1 from information_schema.tables where table_name='payment_accounts'
)
union all
select '0008_circuits', exists (
  select 1 from information_schema.tables where table_schema='public' and table_name='circuits'
)
union all
select '0009_expenses', exists (
  select 1 from information_schema.tables where table_schema='public' and table_name='expenses'
)
union all
select '0010_athlete_open_log', exists (
  select 1 from information_schema.columns where table_name='athletes' and column_name='auth_user_id'
) and exists (
  select 1 from pg_proc where proname='bootstrap_athlete'
)
union all
select '0011_event_cover_photo', exists (
  select 1 from information_schema.columns where table_name='events' and column_name='cover_image_url'
)
union all
select '0012_prevent_duplicate_lane_and_registration_assignments', exists (
  select 1 from pg_constraint where conname='lanes_heat_athlete_unique'
) and exists (
  select 1 from pg_constraint where conname='registrations_event_division_athlete_unique'
)
union all
select '0013_prevent_cross_heat_duplicate_lane_assignment', exists (
  select 1 from pg_trigger where tgname='lanes_prevent_cross_heat_duplicate'
)
union all
select '0014_athlete_lift_times', exists (
  select 1 from information_schema.columns where table_name='athlete_lifts' and column_name='time_seconds'
)
order by migration;
