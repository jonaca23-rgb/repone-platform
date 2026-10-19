-- ============================================================================
-- Removes everything created by seed_qa_circuit.sql.
-- Run this in the Supabase SQL Editor when you're done testing.
-- ============================================================================
begin;

-- Deleting the events cascades to their venues, floors, divisions, wods,
-- heats, lanes, results, standings, registrations, and broadcast_state rows.
delete from events
where name in (
  'QA Circuit — Stop 1: Bayamon Showdown',
  'QA Circuit — Stop 2: San Juan Throwdown',
  'QA Circuit — Stop 3: Caguas Finale'
);

-- The circuit itself isn't a child of events (events point to it, not the
-- other way around), so it needs its own delete.
delete from circuits where name = 'QA Test Circuit — 2026 Sample Season';

-- Athletes are organization-scoped, not event-scoped, so they survive the
-- event deletes above. They are removed by the email the seed gave them, not
-- by name: seed.sql has athletes with some of the same names.
delete from athletes where email like 'qa.athlete%@example.test';

commit;
