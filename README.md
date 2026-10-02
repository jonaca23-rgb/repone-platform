# RepOne Platform

Sports data, scoring, and broadcast-graphics platform for RepOneLive competitions.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind v4)
- **Supabase** (Postgres, Realtime, Storage) and **BetterAuth** for sign-in
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

## Signing in

There is one door: `/login` (and `/signup`). `/athlete/login` and
`/athlete/signup` redirect to them. Email/password accounts must verify their
email before signing in (`/verify-email`); `/forgot-password` and
`/reset-password` handle a lost password.

After signing in, `/` is the start page: one card per module the person's
permissions open (Admin, Scorekeeper, Producer, Commentator, Athlete portal).
An account that only opens the athlete portal goes straight to `/athlete`; a
brand-new account sees an empty start page with "Create my athlete profile".
Each module redirects outsiders back to `/`, and every header has an account
menu to switch modules or sign out.

Owners and admins invite staff by email: organization roles from `/admin/team`,
event roles from an event's Staff page (pending invitations can be resent). The
link (`/invite?token=`) lets the invitee set a password, then sign in.

Email goes out over SMTP, configured by two variables:

| Variable | Local | Production |
|---|---|---|
| `SMTP_URL` | `smtp://127.0.0.1:54525` (Mailpit; read mail at http://127.0.0.1:54524) | the provider's SMTP relay, e.g. `smtps://user:pass@smtp.example.com:465` |
| `EMAIL_FROM` | `RepOne <no-reply@repone.test>` | a sender on a domain verified with the provider |

`pnpm env:local` writes both locally. **Run `pnpm dev:setup` after pulling
auth changes.**

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

| Account | After signing in (`/`, the start page) |
|---|---|
| admin@repone.test | cards for all four staff modules; org owner |
| scorekeeper@repone.test | Scorekeeper card, assigned to every event |
| producer@repone.test | Production card |
| commentator@repone.test | Commentator card |
| athlete@repone.test | forwarded on to `/athlete` (athlete-only), linked to seeded athlete Maria Rivera |
| new-athlete@repone.test | empty start page, not onboarded yet |

Ports are offset so this runs beside other local Supabase projects:

| Service | URL |
|---|---|
| App | http://localhost:3200 |
| Supabase API | http://127.0.0.1:54521 |
| Postgres | postgresql://postgres:postgres@127.0.0.1:54522/postgres |
| Studio | http://127.0.0.1:54523 |
| Mailpit (auth emails) | http://127.0.0.1:54524 |

Sign-in is BetterAuth's (accounts live in Postgres `public."user"`; each
request reaches Supabase with a token the app mints from the session). Supabase
Auth is no longer used. **After pulling this change, run `pnpm dev:setup`**: it
generates the JWT signing key (`supabase/signing_keys.json`, gitignored),
migrates the auth tables and recreates the dev accounts.

`.env.local` (written by `pnpm env:local --force`, except the optional Google
values, which you add by hand) holds:

| Variable | Used by |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | app (browser + server), scripts |
| `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET` | app (server); generate the secret with `openssl rand -base64 32` |
| `DATABASE_URL` | app (BetterAuth's tables), scripts |
| `SUPABASE_JWT_SIGNING_KEY` | app (mints each session's Supabase token), scripts |
| `SUPABASE_SECRET_KEY` | scripts only (service role, bypasses RLS) |
| `SMTP_URL`, `EMAIL_FROM` | app (server): verification, reset and invitation email; see Signing in |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | optional, added by hand (`env:local` doesn't write them); enables "Continue with Google" on the single `/login` and `/signup` |

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
| `pnpm keys:ensure` | Generate `supabase/signing_keys.json` if missing (`--print` prints the private key); run before `supabase start` |
| `pnpm env:local` | Write `.env.local` from `supabase status` (`--force` to overwrite) |
| `pnpm db:rls-check` | Prove the database access rules as each dev account (local only) |
| `pnpm db:standings-check` | Prove concurrent standings rewrites never duplicate or empty a leaderboard (local only) |
| `pnpm db:timer-check` | Prove the broadcast timer's commands (double resume, concurrent operators, adjust) (local only) |
| `pnpm db:authz-check` | Prove who may manage the org, act on an event, drive a floor or score a heat (local only) |
| `pnpm db:auth-check` | Prove BetterAuth sign-up, sign-in and sign-out, and that a session reaches Supabase with the minted token (local only) |
| `pnpm db:invite-check` | Prove invitations: sending, accepting, resending and the mailer failing (local only) |
| `pnpm db:token-check` | Prove local PostgREST accepts tokens the app mints and rejects forged, expired or role-less ones (local only) |
| `pnpm check` | Lint + typecheck + unit tests + format check, the same as CI (run before every commit) |
| `pnpm format` | Biome formatter |

### Production

Deploying to Vercel against a hosted Supabase project needs these, per
environment (Production, Preview):

1. **JWT signing key.** The app signs each session's Supabase token with the
   ES256 private key in `SUPABASE_JWT_SIGNING_KEY` (a JWK with a `kid`). In the
   hosted project, open *Project Settings → JWT Keys → JWT Signing Keys*,
   import that private key, and make it the **current** key. Otherwise
   PostgREST, Realtime and Storage reject every minted token and every
   signed-in request fails with 401. Generate a key for production with
   `pnpm keys:ensure --print` on a machine with no `supabase/signing_keys.json`
   (or any ES256 JWK generator); never reuse the local one.
2. **`DATABASE_URL`** must be the project's **Supavisor pooler** connection
   string (*Connect → Transaction pooler*, port 6543), not the direct
   `db.<ref>.supabase.co` host: that host is IPv6-only and Vercel functions
   can't reach it. `src/db/index.ts` opens at most 4 connections per
   function instance.
3. **`BETTER_AUTH_URL`** is the deployment's own origin, e.g.
   `https://app.example.com`. Preview deployments get a different URL each
   time: set it per environment and add the preview origins to BetterAuth's
   `trustedOrigins` in `src/lib/auth/auth.ts`, or sign-in from a preview is
   refused as cross-origin.
4. **`BETTER_AUTH_SECRET`**: `openssl rand -base64 32`, different per
   environment. Changing it signs everyone out.
5. **`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`** from
   the hosted project's API settings. `SUPABASE_SECRET_KEY` is for scripts
   only and is not needed by the deployed app.
6. **Google (optional).** In Google Cloud, create an OAuth client (Web) with
   the authorized redirect URI `https://<host>/api/auth/callback/google` for
   each host, and set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. BetterAuth
   handles the callback; Supabase's own Google provider is not used and stays
   off.

Apply the migrations to the hosted database (`supabase db push`) before the
first deploy. BetterAuth's sign-in/sign-up rate limit is on in every
environment (3 requests per 10 s per IP, stored in `public.rate_limit`).

7. **Client IP for the rate limit.** Set BetterAuth's `advanced.ipAddress` in
   `src/lib/auth/auth.ts` for the deploy target: `ipAddressHeaders` naming the
   header your platform sets with the real client address (on Vercel,
   `x-real-ip` / `x-forwarded-for`), or `trustedProxies` for your proxy
   chain. If BetterAuth can't resolve a client IP it falls back to one shared
   bucket per path, so 3 failed sign-ins anywhere lock out everyone for 10 s
   (its log says "falling back to a single shared per-path bucket").

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
