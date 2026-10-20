-- ---------------------------------------------------------------------------
-- 0041 — A team's name is unique in its event whatever its inner spacing
--
-- 0036 compared names trimmed and case-folded, so "Aprieta  Duo" could sit
-- beside "Aprieta Duo" in one event, and circuit standings, which collapse
-- spacing, would then count the two as one team. The index now collapses
-- runs of whitespace too; the app stores names that way.
-- ---------------------------------------------------------------------------

drop index if exists teams_event_name_key;
create unique index teams_event_name_key
  on teams (event_id, lower(regexp_replace(btrim(name), '\s+', ' ', 'g')));
