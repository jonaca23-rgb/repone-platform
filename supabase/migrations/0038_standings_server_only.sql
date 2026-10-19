-- ---------------------------------------------------------------------------
-- 0038 — Standings are written by the server only
--
-- Standings are derived from results: the app ranks a division's results and
-- replaces its standings (0026's replace_standings). That ran with the signed-
-- in person's token, so anyone who could save a result could also write the
-- leaderboard directly through the API, around the results it comes from —
-- including after a heat was finished (0034). Now the server writes standings
-- over its own connection, after the action has authorized the person, and no
-- token writes them at all. They stay publicly readable.
-- ---------------------------------------------------------------------------

drop policy if exists "org staff manage standings" on standings;
drop policy if exists "event scorekeeper manage standings" on standings;
drop policy if exists "event producer manage standings" on standings;
drop policy if exists "org production staff manage standings" on standings;

revoke execute on function replace_standings(uuid, uuid, jsonb) from public, anon, authenticated;
