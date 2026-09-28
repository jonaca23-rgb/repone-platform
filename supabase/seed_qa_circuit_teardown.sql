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
-- event deletes above and need to be removed by name.
delete from athletes where (first_name, last_name) in (
  ('Carlos','Rivera'), ('Miguel','Torres'), ('Luis','Ortiz'), ('Jose','Ramirez'),
  ('Angel','Cruz'), ('Rafael','Mendez'), ('David','Colon'), ('Emilio','Vega'),
  ('Hector','Rosario'), ('Julio','Feliciano'), ('Manuel','Diaz'), ('Pedro','Santiago'),
  ('Ricardo','Aponte'), ('Samuel','Nieves'), ('Victor','Maldonado'),
  ('Ana','Delgado'), ('Camila','Ortiz'), ('Valentina','Cruz'), ('Isabella','Vega'),
  ('Gabriela','Torres'), ('Daniela','Rosario'), ('Sofia','Feliciano'), ('Paula','Diaz'),
  ('Carmen','Santiago'), ('Natalia','Aponte'), ('Andrea','Nieves'), ('Laura','Maldonado'),
  ('Estrella','Mendez'), ('Yolanda','Colon'), ('Michelle','Ramirez'),
  ('Jorge','Fuentes'), ('Roberto','Cabrera'), ('Alejandro','Reyes'), ('Francisco','Morales'),
  ('Eduardo','Sosa'), ('Enrique','Padilla'), ('Ivan','Rosado'), ('Marcos','Villanueva'),
  ('Nestor','Cotto'), ('Omar','Serrano'), ('Pablo','Betancourt'), ('Raul','Figueroa'),
  ('Tomas','Guzman'), ('Wilfredo','Lugo'), ('Xavier','Perez'),
  ('Adriana','Sanchez'), ('Brenda','Cardona'), ('Claudia','Ayala'), ('Diana','Rentas'),
  ('Elena','Caban'), ('Fernanda','Rivas'), ('Gloria','Marrero'), ('Heidi','Class'),
  ('Ingrid','Bermudez'), ('Jazmin','Correa'), ('Karla','Ocasio'), ('Leslie','Quinones'),
  ('Miriam','Acevedo'), ('Noemi','Renteria'), ('Patricia','Andino')
);

commit;
