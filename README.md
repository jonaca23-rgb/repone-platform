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

Production is https://reponelive.com: Vercel project `repone-platform` and
Supabase project `repone-platform` (ref `opzmjuwknsvvrtdlpemh`), both under
CFT Services (Vercel team `cftservicespr`). The release flow is the sibling
repo tastebook's, and spends no GitHub Actions minutes:

- **Merging to `main` is a release.** Vercel's Git integration builds `main`
  only (`vercel.json`). Its build, `scripts/vercel-build.sh`, applies
  `supabase/migrations` to production (`supabase db push`, never the seed)
  and then runs `next build`; a failed migration fails the build, so nothing
  ships without its schema. Development lands on `staging` first.
- **Production's values** live in `.env.prod` (gitignored, never pasted
  anywhere). `scripts/push-prod-env.sh` adds the filled ones to Vercel's
  Production environment; a line after a comment containing `[secret]` is
  added as Sensitive. Vercel holds: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL`, `BETTER_AUTH_URL`,
  `BETTER_AUTH_SECRET`, `SUPABASE_JWT_SIGNING_KEY`, `SMTP_URL`, `EMAIL_FROM`
  (and `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` if Google sign-in is on).
  `SUPABASE_SECRET_KEY` and `SUPABASE_DB_PASSWORD` stay in `.env.prod`, for
  scripts only.

What each value has to be:

1. **JWT signing key.** The app signs each session's Supabase token with the
   ES256 private key in `SUPABASE_JWT_SIGNING_KEY` (a JWK with a `kid`). In the
   hosted project, open *Project Settings → JWT Keys*, import that private key
   as a standby key and rotate it in as the **current** key. Otherwise
   PostgREST, Realtime and Storage reject every minted token and every
   signed-in request fails with 401 (the public `/live` pages still work).
   Never reuse the local key.
2. **`DATABASE_URL`** is the **Supavisor transaction pooler** (port 6543), not
   the direct `db.<ref>.supabase.co` host, which is IPv6-only and unreachable
   from Vercel. `src/db/index.ts` opens at most 4 connections per function
   instance; the build derives the session pooler (5432) from it for
   migrations.
3. **`BETTER_AUTH_URL`** is `https://reponelive.com`. It is baked into email
   links and the Google redirect URI. Only `main` deploys, so there are no
   preview origins to trust.
4. **`BETTER_AUTH_SECRET`**: `openssl rand -base64 32`. Changing it signs
   everyone out.
5. **Email.** `SMTP_URL` is Resend's SMTP
   (`smtps://resend:<api key>@smtp.resend.com:465`) and `EMAIL_FROM` is
   `RepOne <no-reply@reponelive.com>`, on the domain verified in Resend. Sign-up
   verification, invitations and password resets all need it.
6. **Client IP for the rate limit.** BetterAuth reads `x-real-ip`, then
   `x-forwarded-for` (`advanced.ipAddress` in `src/lib/auth/auth.ts`), which
   Vercel sets to the client. Without a resolvable IP every visitor would
   share one bucket, and 3 sign-ins anywhere would lock out everyone for 10 s.
7. **Google (optional).** An OAuth client (Web) with the redirect URI
   `https://reponelive.com/api/auth/callback/google`, then `GOOGLE_CLIENT_ID` /
   `GOOGLE_CLIENT_SECRET`. Supabase's own Google provider stays off.

**The first organization.** Right after the first deploy, sign up at
`/signup`, verify the email, and open `/admin`: it offers to create the
organization, and its creator becomes the owner. Only the first one can, so do
it before sharing the URL. Never run `seed.sql`, the QA seeds or
`pnpm dev:accounts` against production. The free Supabase plan pauses a
project after about a week idle: open it before an event.

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
