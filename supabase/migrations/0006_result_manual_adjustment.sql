-- RepOne Platform — manual result adjustment flag
--
-- Judges' scorecards sometimes get corrected after the fact (a claim/protest
-- resolved once the heat is already over). This lets an operator update a
-- result's time/reps/load/points/etc. later while marking that record as
-- manually adjusted — never a silent edit — plus who made the change and
-- when, for accountability.
--
-- The flag reflects the most recent save: checking "Manual Adjustment" and
-- saving sets manually_adjusted = true and stamps adjusted_by/adjusted_at;
-- leaving it unchecked on a save sets manually_adjusted = false and clears
-- those two (see src/lib/actions/results.ts). It is not a permanent history
-- log of every past adjustment — just whether the current recorded result
-- reflects one, and who/when made it.

alter table results
  add column manually_adjusted boolean not null default false,
  add column adjusted_by uuid references auth.users(id),
  add column adjusted_at timestamptz;
