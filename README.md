# RepOne Platform

Sports data, scoring, and broadcast-graphics platform for RepOneLive competitions.
See `/architecture` in the attached claude.ai project (or ask Claude) for the full
Current State / Gap Analysis / Proposed Architecture writeup this build follows.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind v4)
- **Supabase** (Postgres, Auth, Realtime, Storage)
- **Vitest** for the scoring engine and timer math unit tests

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

## Local setup

1. Create a Supabase project.
2. Run the SQL in `supabase/migrations/` (in order) against it, then
   `supabase/seed.sql` if you want sample data.
3. Copy `.env.local.example` to `.env.local` and fill in your project's URL
   and anon key.
4. `npm install`
5. `npm run dev`
6. Visit `/admin`, create your organization (first screen), create an event,
   then Divisions → WODs → Heats & Lanes → Athletes. Sign-up for the first
   user has to happen via Supabase Auth directly (dashboard or `supabase
   auth` CLI) — there's no public sign-up screen yet, by design.
7. Point OBS/vMix/YoloBox browser sources at `/overlay/<floorId>/program`
   (and any of the standalone layers) — `/overlay/<floorId>` lists every URL
   for that floor.

## Tests

```
npm test    # scoring engine + timer math
npm run build
```
