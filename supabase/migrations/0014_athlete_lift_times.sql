-- Jonathan asked for three running benchmarks — 400m, 1 Mile, 5K — added to
-- the athlete profile's "Basic Lifts" section alongside the existing 9
-- barbell lifts, so they're tracked as fixed, named PRs the same way (one
-- current best per entry) rather than through the free-form Benchmark
-- Workouts section. Since a run is timed, not loaded, `athlete_lifts` needs
-- to hold either a weight OR a time depending on which lift a row is for.

alter type lift_name add value 'run_400m';
alter type lift_name add value 'run_1_mile';
alter type lift_name add value 'run_5k';

alter table athlete_lifts
  alter column weight_lbs drop not null,
  add column time_seconds numeric;

-- Exactly one of the two must be set — never both, never neither. Which one
-- a given row uses is determined entirely by `lift` (the app only ever
-- writes weight_lbs for the 9 barbell lifts and time_seconds for the 3 run
-- benchmarks — see WEIGHT_LIFT_NAMES/TIME_LIFT_NAMES in
-- src/lib/constants/lifts.ts), but this constraint guards the data either
-- way, including against a future direct edit.
alter table athlete_lifts
  add constraint athlete_lifts_weight_xor_time
  check ((weight_lbs is not null) <> (time_seconds is not null));
