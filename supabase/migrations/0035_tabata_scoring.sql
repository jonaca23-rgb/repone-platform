-- ---------------------------------------------------------------------------
-- 0035 — Tabata scoring
--
-- A Tabata WOD (8 rounds of 20 s work, 10 s rest) is scored by total reps
-- across the rounds: one number per competitor in results.reps, highest wins,
-- like an AMRAP. It is its own type so WODs, screens and graphics name it.
-- ---------------------------------------------------------------------------

alter type scoring_type add value if not exists 'tabata';
