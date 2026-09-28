-- RepOne Platform — remove the RepOne Open Log feature
--
-- Jonathan asked to remove RepOne Open Log (self-submitted workout history,
-- added in 0010_athlete_open_log.sql) while keeping athlete self-service
-- accounts (signup/login, athletes.auth_user_id, bootstrap_athlete()) in
-- place for future use. Confirmed with Jonathan that no real athlete data
-- exists in athlete_open_logs yet, so this is a plain drop rather than a
-- migration with a backup/export step.
--
-- `if exists` throughout so this is safe to run once, regardless of whether
-- 0010's table ever actually got created in this database. Dropping the
-- table also drops its indexes, triggers, and RLS policies with it — nothing
-- else to clean up separately.

drop table if exists athlete_open_logs;
drop type if exists open_classification;
drop type if exists open_result_modality;
