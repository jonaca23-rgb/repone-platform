# Pending Gaps and Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close every gap and minor fix left open by PRs #29–#36 before new features (the user asked for all of them, 2026-10-18).

**Architecture:** Five PRs, grouped by area so each one can be reviewed on its own. Every fix is test-first where behaviour changes. Copy and typing fixes are pinned by the existing suite.

**Branches:** One per PR, from `staging`, each PR against `staging`. Merge under the standing authorization once CI is green and its review is settled.

## Global Constraints

- `pnpm check && git commit`, chained. Stage files by name. Plain-sentence titles. The last line is `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Migrations continue at `0038`. Verify them with `pnpm db:reset && pnpm db:types && pnpm dev:accounts && ./scripts/seed-qa.sh` and every `db:*-check`.

---

## PR 1 — Scoring integrity (`fix/scoring-integrity`)

1. **Standings writes leave the floor staff's token** (#33 follow-up; user option B).
   - Today the app ranks results with the signed-in user's token, and that token can write `standings` directly through PostgREST.
   - The fix:
     - `recompute.ts` writes through a server-only module, `src/lib/scoring/writeStandings.ts`, which calls `replace_standings` over the owner connection (`@/db`), the same connection BetterAuth uses.
     - Callers have already authorized the user: `requireHeatAccess` in `enterResult` and `finishHeat`.
     - The ESLint allow-list gains that one file, with a comment saying why.
   - Migration `0038_standings_server_only.sql`:
     - drop every write policy on `standings`, so the table is publicly readable but written by nobody through the API;
     - revoke EXECUTE on `replace_standings` from `authenticated`.
   - Checks:
     - `rls-check`: the scorekeeper, producer, scoring_operator, production_director and admin can no longer insert standings or call `replace_standings`;
     - `standings-check`: switches to the service client.
2. **The finished-heat lock also covers lanes** (#33 minor).
   - Today floor staff can edit the lanes of a finished heat. Removing a lane hides that competitor and makes the organizer's correction get refused.
   - Extend `guard_finished_heat`'s rule to `lanes` with a trigger: on a finished heat, only organizers insert, update or delete lanes.
3. **The finished-heat RLS checks cover the other roles** (#33 minor): the org-wide `scoring_operator` and `production_director`, and `event_director` as a positive case.
4. **CI: turn off `edge_runtime`** in `supabase/config.toml`. The app has no edge functions, and the edge_runtime container failed its health check with a 502 in CI.

## PR 2 — Scoring polish (`fix/scoring-polish`)

1. **One `ScoringType`.** `format.ts` re-exports the one in `types.ts`, and both alias the database enum. `SCORING_LABEL` is typed `Record<ScoringType, string>`, and `countsReps` takes a `ScoringType`.
2. **Labels.** The admin heat's subtitle uses `scoringLabel`, so it reads "AMRAP" and "Tabata" instead of "amrap" and "tabata". The WOD options and the other screens use the same label, "Tabata (total reps)" in the form and "Tabata" elsewhere, so they stop disagreeing.
3. **A completed AMRAP or Tabata result needs its reps.**
   - `enterResult` refuses a blank count with "Total reps is required." on the reps field.
   - This matches how a completed For Time result without a time behaves today. Check that before deciding: if blank times are accepted, accept blank reps too and leave this as a ruling.
4. **The QA seed has a Tabata WOD.**
5. **`ActionSwitch` is a 44px target on phones.** Wrap it in a label row with `min-h-11`; the switch itself is drawn as before.

## PR 3 — Teams polish (`fix/teams-polish`)

1. **The roster picker searches.** Replace the plain Select with a searchable command list, filtered by name or affiliate, so a large organization still fits.
2. **Team names collapse inner spaces.**
   - The migration (`0039`, or the next free number) changes the unique index to `lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))`.
   - `createTeam` and `updateTeam` store the collapsed name, which matches `circuitCompetitorKey`.
3. **The public circuit page** says teams are matched by name.
4. **`.claude/skills/verify-repone/SKILL.md`** points to the event's Teams page.
5. **`TeamCard` keys members** by index plus name.
6. **The admin Lanes tab handles a lane holding the other kind** (left from before #35): it shows a "{name} (wrong kind for this division)" option so the lane isn't blank, and saving replaces it.
7. **Athlete portal.**
   - The team-registration lookup runs inside the page's main `Promise.all`, through one shared helper (`teamRegistrationsFor(athleteId)`) also used by `getAthleteCurrentStanding`.
   - The individual-over-team choice in the same live event is documented and tested.
8. **Competition history includes team results.** `getAthleteCompetitionHistory` adds the overall standings of the athlete's teams, labelled with the team's name. This covers the athlete portal, the directory profile and the commentator cards.

## PR 4 — Sponsors and venue display polish (`fix/sponsors-display-polish`)

1. **Override placeholders follow the package select** in the event-sponsorship edit dialog.
2. **A sponsor switched off org-wide no longer holds its exclusive category.**
   - The exclusivity check counts only active sponsors.
   - Re-activating a sponsor re-runs the check: a trigger on `sponsors.active`.
3. **`setActiveSponsor` refuses a sponsor that is switched off org-wide.**
4. **Uploads don't leave orphan files.** When the database write after a logo or creative upload fails, the uploaded object is removed.
5. **"Exclusive" needs a category.** The event-sponsorship form says so, and the action refuses exclusive for a sponsor without a category.
6. **`sponsor-check` covers other organizations.** It adds a cross-org attach attempt and a cross-org storage write attempt.
7. **No blank org id.** The Sponsors and event Sponsors pages take the org id from `requireOrgManager()` instead of `ctx?.organizationId ?? ""`.
8. **A venue display URL with a non-UUID id gives a 404**, not the retry screen.
9. **Display settings save in one transaction** through an RPC: the device update and the blocks upsert.
10. **A heat that ends mid-item makes the player advance** to the next item instead of showing standby for the rest of the item.

## Verification and review

- Each PR runs its checks. Where it changes a screen, it gets a short browser run.
- Each PR gets one independent review sized to its risk: the most capable model for PR 1, a mid-tier model for the polish PRs.
- Critical and Important findings are fixed test-first before merge.
