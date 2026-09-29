# RepOne Platform — Initial Audit (2026-09-28)

Baseline: `main` @ `11b10d8`. Read-only audit. No code was changed.

## 1. Current status at a glance

| Area | Status |
|---|---|
| Typecheck (`tsc --noEmit`) | ✅ passes |
| Lint (`eslint`) | ✅ passes |
| Unit tests (`vitest`) | ✅ 26/26, but they cover only pure scoring and timer math |
| Production build (`next build`) | ✅ passes (all routes dynamic except `/login`) |
| `npm audit` (prod) | ✅ 0 vulnerabilities |
| Dependencies | Minor bumps available (next 16.3.6, supabase-js 2.117, zod 4.6). Majors pending: eslint 10, TS 7, vitest 5 |
| Local dev stack | ❌ none. There's no `supabase/config.toml`, and the app needs a remote Supabase project |
| Migrations workflow | ❌ SQL is pasted by hand into the Supabase SQL Editor. `migration_check.sql` exists to *guess* what has been applied |
| Env template | ❌ The README points to `.env.local.example`, which doesn't exist (`.gitignore` excludes `.env*`) |
| DB types | ⚠️ `database.types.ts` is hand-written, with Row types only. The Supabase clients are untyped, which leads to 27 `as unknown as` casts |
| CI/CD | ❌ no GitHub Actions, no git hooks, not linked to Vercel |
| Error or loading UI | ❌ no `error.tsx`, `loading.tsx`, `not-found.tsx` or `global-error.tsx` anywhere |
| Package manager | npm (`package-lock.json`) |

**Stack.** Next.js 16.3.4 (App Router, `proxy.ts`), React 19.2, Supabase (Postgres, Auth, Realtime, Storage), Tailwind v4, Vitest. About 13.7k lines of TypeScript and 24 migrations. The only env vars are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. There is no service-role key.

**History.** The repo has 3 commits: the scaffold and the initial platform (Claude, 2026-09-01), then one large commit covering payments, teams, circuits, messaging, staff roles and athlete features (jonaca23-rgb, 2026-09-28). Remote: `github.com/jonaca23-rgb/repone-platform`.

## 2. Feature inventory

| Area | Access control | State |
|---|---|---|
| `/admin`: events, divisions, WODs, heats and lanes, athletes, check-in, circuits, teams, sponsors, fees, payments, statement, staff, messages | Login only. **There is no admin-role check** | Most complete. Payments are manual ("Stripe (future)"). The cross-event statement is marked as future work |
| `/scorekeeper` | Scorekeeper or producer assignment | Works: per-lane entry and finish heat |
| `/dashboard/[floorId]` (production control) | Producer assignment | Works: heat select, graphics, timer |
| `/producer` | Producer assignment | `broadcast` is a redirect stub. heats, dashboard and scores are thin wrappers |
| `/commentator` | Commentator or producer | `notes` is a placeholder ("not built yet") |
| `/athlete` | Checked per page | Email and Google signup, onboarding, directory, likes, messages, lifts |
| `/live` (public) | None (public RLS read) | Event leaderboard, circuits |
| `/overlay/[floorId]/*` (OBS) | None (public RLS read) | program, timer, heat, lanes, wod, lower-third, leaderboard, sponsor |

## 3. Findings (prioritized)

Severity reflects impact during a live competition or on athlete data.

### Critical

- **C1. Athlete PII is readable by anyone, without logging in.**
  - Where: `0016:106` and `0018:36` use `revoke select (email, phone, …) from anon`.
  - Why it fails: Supabase grants a **table-level** SELECT to `anon`, and a column-level revoke doesn't override it.
  - Impact: `GET /rest/v1/athletes?select=email,phone,date_of_birth,auth_user_id` with the public anon key returns everything. Every signed-in user can also read every org's athletes (`0002:60`).
  - Fix: revoke table SELECT from `anon`, then grant only the safe columns, or put a `public_athletes` view in front of overlays and `/live`.
- **C2. Overall standings reward DNF, DNS and DQ as if they won.**
  - How:
    - `rankWodResults` gives non-completed results `wodPoints: null`.
    - `computeOverallStandings` (`scoring/standings.ts:25`) turns null into `(fieldSizeByWod[wod] ?? 0) + 1`.
    - The only caller (`actions/standings.ts:95`) never passes `fieldSizeByWod`.
    - Result: a DNF gets **1 point**, the same as first place.
  - Also: competitors with no result row for a WOD are simply left out of that WOD's total. Lower total wins, so a missing WOD *helps*.
  - No test covers either case.
- **C3. Standings are rewritten non-atomically.**
  - `writeStandings` (`actions/standings.ts:134-153`) does a delete then an insert, with no transaction and errors ignored.
  - Overall rows (`wod_id IS NULL`) have no effective unique constraint, because NULLs count as distinct (`0001:236`).
  - Two scorekeepers saving at the same time can leave duplicated or empty leaderboards on the live broadcast.

### High

- **H1. Any signed-up user can make themselves an admin.** `bootstrap_organization` (`0003`) only checks "no org yet". Athletes never have an org, so any athlete can create one and become its admin.
- **H2. Athlete signup picks the org nondeterministically.** `bootstrap_athlete` (`0019:64`) uses `select organization_id from profiles where organization_id is not null limit 1` with no ORDER BY. Once a second org exists, which H1 makes trivial, new athletes can land in the wrong or attacker's org.
- **H3. Storage is writable by any signed-in user.** `0005` and `0011` let any authenticated user upload, overwrite or delete any object in `athlete-photos` or `event-photos`, including images shown on the broadcast. There are no bucket MIME or size limits, and the server validates only the client-supplied `file.type`.
- **H4. Open redirect after OAuth.** `auth/callback/route.ts:22,28` redirects to `${origin}${next}`, so `?next=@evil.com` sends the user off-site after login.
- **H5. `/admin` has no role gate.** `admin/layout.tsx:18` checks only for a session. Separately, `isAssignedToEvent` (`auth/eventRoles.ts:41`) returns true for an admin on *any* event, regardless of org.
- **H6. The scorekeeper can save a score to the wrong athlete.** Lane forms use `key={lane.laneNumber}` with uncontrolled inputs (`ScoreKeeperClient.tsx:207`). When "Follow live" switches heats, half-typed values stay in the lane-N form while the hidden `competitor_id` changes.
- **H7. The production dashboard fails silently.**
  - `DashboardClient.go()` fires actions without awaiting them. There's no pending or error feedback during a live show.
  - Many timer, graphics and heat writes ignore `error`: 74 destructures take `{ data }` only, against 58 that check `error`.
  - If the `broadcast_state` row is missing, every update matches 0 rows and silently does nothing.
- **H8. Server actions rely entirely on RLS for authorization.**
  - Most actions don't check a role. RLS denials return 0 rows, which the code treats as success.
  - `zod` is a dependency, but nothing imports it, so enums, IDs and lengths go unvalidated.

### Medium

- **M1. Migration drift and non-idempotency.**
  - Bare `create` statements, and `add value` without `if not exists` (`0014`).
  - The chain 0020 → 0021 (rollback) → 0022 breaks on any DB that skipped 0021.
  - `0012/0013` delete duplicate registrations, and the delete cascades to `payments`.
  - `fix_qa_circuit_org.sql` re-parents athletes matched *by name* and is unsafe to rerun.
- **M2. SECURITY DEFINER functions lack a `search_path`.** `has_role` (`0002:13`) is SECURITY DEFINER without `set search_path`. `set_updated_at` and the 0013 trigger have the same gap. `auth.uid()` is not wrapped in `(select …)` inside policies.
- **M3. Missing FK indexes on hot paths.** `heats(event_id)`, `lanes(athlete_id)`, `results(wod_id)`, `registrations(athlete_id)`, `divisions`/`wods`/`venues(event_id)`, `floors(venue_id)`, `athletes(organization_id)`, `team_members(athlete_id)`.
- **M4. Policy holes.**
  - An athlete can insert a roster row with someone else's `auth_user_id` (`0017:103`).
  - A producer can change their event's `organization_id` (`0024:195`).
  - The recipient of a message can rewrite its body (`0016:70`).
  - `operator_actions` rows can be inserted with a forged `user_id`.
- **M5. Timer problems.**
  - `resumeTimer` has no status guard, so a double-click resets the anchor.
  - The anchor uses server time but clients use their local clock, so skewed OBS PCs show a constant offset.
  - Seeding from `Date.now()` during SSR causes hydration mismatches.
- **M6. Realtime problems.**
  - There's no refetch after reconnect.
  - A DELETE event sets state to `{}`.
  - Channel names aren't unique per hook instance, so two mounts in one tab can kill each other's feed.
  - Overlays load heats, lanes and sponsors once, so they need an OBS refresh after changes.
  - Scorekeepers don't see each other's entries live.
- **M7. `revalidatePath('/overlay')` and `revalidatePath('/dashboard')` are no-ops for `[floorId]` routes.**
- **M8. The `rank.ts` comparator can return `NaN`.** Two null times give `Infinity - Infinity`, which leaves the sort order undefined. `lowerIsBetter` and `timeCapSeconds` are never read.
- **M9. Queries.**
  - N+1 loading in `db/commentator.ts:41-58`.
  - Unbounded reads: the inbox and admin lists. PostgREST truncates silently at 1000 rows.
  - `getSessionContext` isn't wrapped in `React.cache`: 3 queries per call, 37 call sites.

### Low

- **L1. Accessibility.** Very little ARIA: 4 attributes across 97 buttons. There's no `aria-live` on the leaderboard or timer. Status is shown by emoji or colour only.
- **L2. Missing confirmations and timezone.** Deleting a heat or WOD has no confirmation. Server-rendered dates show in UTC.
- **L3. Images and caching.** There's no `next/image` (21 raw `<img>` tags) and no caching of public, rarely-changing data.
- **L4. Duplicated code.** The heat-to-`FloorHeat` mapping appears twice in `queries.ts`. Result-row building is duplicated in `results.ts`.
- **L5. `next.config.ts` carries an old OneDrive workaround.** It disables the Turbopack dev FS cache for the previous developer's machine and can be removed.
- **L6. Vitest config warning.** `vitest.config.ts` triggers a Vite warning about ESM in a CommonJS package. Renaming it to `.mts` fixes it.

## 4. Test coverage gaps

The tests cover `rank`, `divisionOrder`, `ageCategory` and `timer/compute` only. Nothing is covered in:
- standings recompute and write, including overall standings with DNF or missing WODs (see C2);
- results and lanes actions;
- timer actions;
- `eventRoles`;
- RLS policies (there's no automated RLS check);
- realtime hooks.

## 5. Recommended order of work

1. **Dev environment.** Set up pnpm, a local Supabase stack on Podman (`supabase/config.toml` with offset ports, `scripts/supabase.sh`), and `pnpm dev:setup` (start → reset → gen types → dev accounts). Add a `.env.local.example`, `supabase gen types`, Biome formatting, and CI with an RLS check. This mirrors `school-schedule`. Every fix below then gets verified against a real local DB.
2. **Security migration 0025.** Fixes C1, H1, H2, H3, M2, M4, plus an RLS test script that proves them.
3. **Scoring correctness.** Fixes C2, C3 and M8, with tests first. Recompute standings inside a transactional RPC.
4. **Live-event robustness.** Fixes H6, H7, M5, M6, and adds error boundaries.
5. **Authorization layer.** Fixes H5 and H8: a shared `requireRole` helper and zod schemas for actions.
6. **Migration baseline for prod.** Adopt `supabase db push` and migration history. First confirm what production has actually applied.
7. **Performance, accessibility and features.** M3, M9, L1–L4, then the feature roadmap: Stripe, commentator notes, producer broadcast.
