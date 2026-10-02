-- ---------------------------------------------------------------------------
-- 0031 — Org-wide working roles reach every event like their assignment
--
-- An org-wide role (member.role, granted from Admin → Members) must give, on
-- every event of its organization, exactly what the matching event assignment
-- (0024) gives on one event, as src/lib/auth/permissions.ts already says:
--   production_director ≈ event producer:   heats, lanes, results, standings,
--                                           broadcast_state, read the field
--   scoring_operator    ≈ event scorekeeper: heats, lanes, results, standings,
--                                           read the field
--   commentator         ≈ event commentator: read the field
-- The 0002 policies left gaps (a production director couldn't save results,
-- a scoring operator couldn't finish heats, none of them could read
-- registrations), so the app offered screens whose saves failed. This only
-- ADDS policies; no existing one changes. has_role() reads member (0029).
-- Proven by scripts/rls-check.ts ("Org-wide staff roles …").
-- ---------------------------------------------------------------------------

-- scoring_operator: heats (production_director is already in "org staff manage heats").
create policy "org scoring staff manage heats" on heats for all
  using (exists (select 1 from events e where e.id = heats.event_id
    and has_role(e.organization_id, array['scoring_operator']::user_role[])))
  with check (exists (select 1 from events e where e.id = heats.event_id
    and has_role(e.organization_id, array['scoring_operator']::user_role[])));

-- production_director + scoring_operator: lanes.
create policy "org working staff manage lanes" on lanes for all
  using (exists (select 1 from heats h join events e on e.id = h.event_id
    where h.id = lanes.heat_id
      and has_role(e.organization_id, array['production_director','scoring_operator']::user_role[])))
  with check (exists (select 1 from heats h join events e on e.id = h.event_id
    where h.id = lanes.heat_id
      and has_role(e.organization_id, array['production_director','scoring_operator']::user_role[])));

-- production_director: results and standings (scoring_operator already has both).
create policy "org production staff manage results" on results for all
  using (exists (select 1 from heats h join events e on e.id = h.event_id
    where h.id = results.heat_id
      and has_role(e.organization_id, array['production_director']::user_role[])))
  with check (exists (select 1 from heats h join events e on e.id = h.event_id
    where h.id = results.heat_id
      and has_role(e.organization_id, array['production_director']::user_role[])));

create policy "org production staff manage standings" on standings for all
  using (exists (select 1 from events e where e.id = standings.event_id
    and has_role(e.organization_id, array['production_director']::user_role[])))
  with check (exists (select 1 from events e where e.id = standings.event_id
    and has_role(e.organization_id, array['production_director']::user_role[])));

-- All three working roles: read the event's field (registrations), read-only.
create policy "org working staff read registrations" on registrations for select
  using (exists (select 1 from events e where e.id = registrations.event_id
    and has_role(e.organization_id,
      array['production_director','scoring_operator','commentator']::user_role[])));
