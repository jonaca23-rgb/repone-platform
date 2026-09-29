# RepOne Platform

Sports data, scoring, and broadcast-graphics platform for RepOneLive competitions.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind v4)
- **Supabase** (Postgres, Auth, Realtime, Storage)
- **Vitest** for the scoring engine and timer math unit tests
- **pnpm**, local Supabase via the Supabase CLI on Podman, Biome (format), ESLint (lint)

## What's implemented (Phase 1–5 slice)

- Full Postgres schema (`supabase/migrations/`): events, venues, floors,
  divisions, athletes/teams, registrations, WODs, heats, lanes, raw results,
  computed standings, sponsors, broadcast state, operator action log, roles + RLS.
- Scoring engine (`src/lib/scoring/`): pure, framework-free ranking + overall
  standings, covered by unit tests.
- Server-authoritative timer math (`src/lib/timer/`): anchor-based, drift-free,
  covered by unit tests.
- Admin UI (`/admin`): events, divisions, athlete roster, per-event
  registrations, WODs, venues/floors, heats + lane assignment, results entry.
- Production Dashboard (`/dashboard/[floorId]`): heat navigation, timer
  controls, graphics triggers, lower-third, sponsor buttons — touch-friendly.
- Broadcast overlays (`/overlay/[floorId]/...`): `program` (single
  browser-source engine driven by the dashboard's Show buttons), plus
  standalone `timer`, `heat`, `lanes`, `wod`, `lower-third`, `leaderboard`,
  `sponsor` layers. All transparent-background, all Realtime-synced.

## Running it locally

Requirements: Node 24, pnpm 10 (`corepack enable`), the Supabase CLI, and a
container runtime (Podman or Docker). With Podman, `scripts/supabase.sh`
points the Supabase CLI at the Podman machine's socket for you.

```
pnpm install
pnpm dev          # Podman -> local Supabase -> .env.local -> seeds -> dev accounts -> Next.js
```

`pnpm dev` is safe to run every time: each step is skipped when already done.
The first run applies every migration in `supabase/migrations/` and
`supabase/seed.sql`, loads the QA circuit (`supabase/seed_qa_circuit.sql`), and
prints one login per role (password `Repone1234!`):

| Account | Lands on |
|---|---|
| admin@repone.test | `/admin`, org admin |
| scorekeeper@repone.test | `/scorekeeper`, assigned to every event |
| producer@repone.test | `/producer`, `/dashboard` |
| commentator@repone.test | `/commentator` |
| athlete@repone.test | `/athlete`, linked to seeded athlete Maria Rivera |
| new-athlete@repone.test | `/athlete`, not onboarded yet |

Ports are offset so this runs beside other local Supabase projects:

| Service | URL |
|---|---|
| App | http://localhost:3200 |
| Supabase API | http://127.0.0.1:54521 |
| Postgres | postgresql://postgres:postgres@127.0.0.1:54522/postgres |
| Studio | http://127.0.0.1:54523 |
| Mailpit (auth emails) | http://127.0.0.1:54524 |

### Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Bring up the whole stack, then `next dev` on :3200 |
| `pnpm dev:setup` | Clean slate: reset DB, re-apply migrations + seeds, regenerate types, recreate accounts |
| `pnpm dev:next` | Only `next dev` (stack already running) |
| `pnpm db:start` / `db:stop` / `db:status` | Local Supabase lifecycle |
| `pnpm db:reset` | Wipe and re-apply migrations + `seed.sql` |
| `pnpm db:seed:qa` | Load the QA circuit if it isn't there |
| `pnpm db:types` | Regenerate `src/lib/db/supabase.types.ts` from the local schema |
| `pnpm dev:accounts` | Create/reset the dev logins (local only) |
| `pnpm env:local` | Write `.env.local` from `supabase status` (`--force` to overwrite) |
| `pnpm check` | Lint + typecheck + unit tests (run before every commit) |
| `pnpm format` | Biome formatter |

### Schema changes

Add a new file `supabase/migrations/NNNN_description.sql`, then
`pnpm db:reset && pnpm db:types` and commit both the migration and the
regenerated types (CI fails if they drift).

### Broadcast overlays

Point OBS/vMix/YoloBox browser sources at `/overlay/<floorId>/program` (and
any of the standalone layers). `/overlay/<floorId>` lists every URL for that
floor. The seeded floor is `00000000-0000-0000-0000-000000000030`.

## Status

Not in production. See `docs/audit/2026-09-28-initial-audit.md` for the
current audit and the prioritized fix list.
