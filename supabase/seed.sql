-- Sample data for local development: one event, one floor, one WOD, one heat.
-- Run after 0001/0002 migrations: `supabase db reset` applies migrations + this seed.

insert into organizations (id, name, slug) values ('00000000-0000-0000-0000-000000000001', 'RepOneLive', 'repone-live');

insert into events (id, organization_id, name, status, starts_on, ends_on) values
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001',
   'Aprieta Entry Level', 'live', '2026-09-01', '2026-09-01');

insert into venues (id, event_id, name) values
  ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000010', 'Main Venue');

insert into floors (id, venue_id, name, sort_order) values
  ('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000020', 'Floor A', 0);

insert into broadcast_state (floor_id) values
  ('00000000-0000-0000-0000-000000000030');

insert into divisions (id, event_id, name, sort_order) values
  ('00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000010', 'Intermediate Female', 0);

insert into wods (id, event_id, name, description, rules, scoring_type, time_cap_seconds, tiebreak_type, lower_is_better, sort_order) values
  ('00000000-0000-0000-0000-000000000050', '00000000-0000-0000-0000-000000000010', 'WOD 2',
   'For Time: 21-15-9 Thrusters (95/65) and Pull-ups', 'Rx weights as listed. Scale to 65/45 if needed.',
   'for_time', 900, 'reps', true, 1);

insert into athletes (id, organization_id, first_name, last_name, affiliate, email) values
  ('00000000-0000-0000-0000-000000000061', '00000000-0000-0000-0000-000000000001', 'Maria', 'Rivera', 'CrossFit Aprieta', 'maria@example.test'),
  ('00000000-0000-0000-0000-000000000062', '00000000-0000-0000-0000-000000000001', 'Sofia', 'Delgado', 'Box 787', 'sofia@example.test'),
  ('00000000-0000-0000-0000-000000000063', '00000000-0000-0000-0000-000000000001', 'Camila', 'Ortiz', 'CrossFit San Juan', 'camila@example.test'),
  ('00000000-0000-0000-0000-000000000064', '00000000-0000-0000-0000-000000000001', 'Valentina', 'Cruz', 'Box 787', 'valentina@example.test'),
  ('00000000-0000-0000-0000-000000000065', '00000000-0000-0000-0000-000000000001', 'Isabella', 'Vega', 'CrossFit Aprieta', 'isabella@example.test'),
  ('00000000-0000-0000-0000-000000000066', '00000000-0000-0000-0000-000000000001', 'Gabriela', 'Torres', 'CrossFit San Juan', 'gabriela@example.test');

insert into registrations (event_id, division_id, athlete_id) values
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000061'),
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000062'),
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000063'),
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000064'),
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000065'),
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000066');

-- Heat 6 of 9 for WOD 2, Intermediate Female
insert into heats (id, event_id, floor_id, wod_id, division_id, heat_number, heat_count, scheduled_start) values
  ('00000000-0000-0000-0000-000000000070', '00000000-0000-0000-0000-000000000010',
   '00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000050',
   '00000000-0000-0000-0000-000000000040', 6, 9, now());

insert into lanes (heat_id, lane_number, athlete_id) values
  ('00000000-0000-0000-0000-000000000070', 1, '00000000-0000-0000-0000-000000000061'),
  ('00000000-0000-0000-0000-000000000070', 2, '00000000-0000-0000-0000-000000000062'),
  ('00000000-0000-0000-0000-000000000070', 3, '00000000-0000-0000-0000-000000000063'),
  ('00000000-0000-0000-0000-000000000070', 4, '00000000-0000-0000-0000-000000000064'),
  ('00000000-0000-0000-0000-000000000070', 5, '00000000-0000-0000-0000-000000000065'),
  ('00000000-0000-0000-0000-000000000070', 6, '00000000-0000-0000-0000-000000000066');

insert into sponsors (id, organization_id, business_name, category) values
  ('00000000-0000-0000-0000-000000000081', '00000000-0000-0000-0000-000000000001', 'Isla Physical Therapy', 'Physical Therapy'),
  ('00000000-0000-0000-0000-000000000082', '00000000-0000-0000-0000-000000000001', 'Borinquen Nutrition', 'Nutrition'),
  ('00000000-0000-0000-0000-000000000083', '00000000-0000-0000-0000-000000000001', 'San Juan Sports Gear', 'Retail');

-- What each sponsor bought for the demo event (packages come from the
-- organizations trigger in 0032).
insert into event_sponsorships (event_id, sponsor_id, package_id, category_exclusive)
select '00000000-0000-0000-0000-000000000010', s.id, p.id, s.exclusive
from (values
  ('00000000-0000-0000-0000-000000000081'::uuid, 'Presenting Sponsor', true),
  ('00000000-0000-0000-0000-000000000082'::uuid, 'WOD Sponsor', false),
  ('00000000-0000-0000-0000-000000000083'::uuid, 'Logo Sponsor', false)
) as s(id, package_name, exclusive)
join sponsor_packages p on p.organization_id = '00000000-0000-0000-0000-000000000001' and p.name = s.package_name;
