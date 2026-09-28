-- ============================================================================
-- One-time fix: moves the QA sample data (circuit, events, athletes) from
-- whichever organization the seed script happened to target into YOUR real
-- organization (found via your profile row).
-- Run this once in the Supabase SQL Editor, then refresh the app.
-- ============================================================================
begin;

do $$
declare
  v_real_org uuid;
begin
  select organization_id into v_real_org
  from profiles
  where organization_id is not null
  limit 1;

  if v_real_org is null then
    raise exception 'Could not find your organization via profiles — tell Claude before proceeding.';
  end if;

  update circuits set organization_id = v_real_org
    where name = 'QA Test Circuit — 2026 Sample Season';

  update events set organization_id = v_real_org
    where name in (
      'QA Circuit — Stop 1: Bayamon Showdown',
      'QA Circuit — Stop 2: San Juan Throwdown',
      'QA Circuit — Stop 3: Caguas Finale'
    );

  update athletes set organization_id = v_real_org
    where (first_name, last_name) in (
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
end $$;

commit;
