---
name: verify-repone
description: Drive the real RepOne web app (Next.js + local Supabase) in a browser as each role — admin, scorekeeper, producer, commentator, athlete, anonymous viewer — and capture proof that a user-facing feature works. Use after changing anything a user touches (scoring, leaderboards, overlays, staff screens, athlete portal, access rules), before claiming a fix works, or when asked to "verify", "prove", "drive the app", or "check it in the browser".
---

# Verify RepOne in the real app

RepOne is one Next.js web app with several audiences: staff screens behind `/login` (`/admin`, `/scorekeeper`, `/producer`, `/dashboard`, `/commentator`), the athlete portal (`/athlete`), and public pages with no login (`/live` leaderboards, `/overlay/<floorId>/*` OBS browser sources). All of it runs locally against a local Supabase stack on Podman. There is no production; every run uses the local seed data and dev logins.

Helpers live in `.claude/skills/verify-repone/scripts/` (run from anywhere in the checkout). Feature recipes live in `features/` — read `features/README.md` first, then the feature's file.

## 1. Launch

```bash
./.claude/skills/verify-repone/scripts/app.sh start
```

- Reuses this checkout's server on :3200 if one is already running (and will not stop it later).
- Otherwise runs `pnpm dev`, which brings up Podman → Supabase (migrations + seed) → `.env.local` → QA seed → dev accounts → `next dev --port 3200`. First cold start takes 1-3 minutes; later ones seconds.
- Ready when it prints `Ready: http://localhost:3200` (it polls `/login` for a 200). Log: `.verify/run/dev.log`.
- Refuses to proceed if :3200 belongs to another checkout. Next.js allows one dev server per directory and Supabase auth only redirects to :3200, so there is exactly one instance per machine — never start a second one, and never drive one you didn't check.

Teardown is step 5.

## 2. Doctor

```bash
./.claude/skills/verify-repone/scripts/doctor.sh
```

Read-only. Checks: Supabase container and API up, `.env.local` targets the local stack, every migration applied, seed event + QA circuit present, 6 dev accounts, and the :3200 server belongs to THIS checkout and answers `/login`. Exit 0 = drive it. Each `FAIL` line prints its fix. A `warn` about Podman VM memory means pages will stall (every local Supabase stack on the machine shares that VM): expect 10-60s requests, or stop stacks you don't need first. Run it first, and again whenever anything looks off (login loops, empty pages, 500s).

`./.claude/skills/verify-repone/scripts/fixtures.sh` prints the logins, seed ids and URLs. Logins: `admin@`, `scorekeeper@`, `producer@`, `commentator@`, `athlete@`, `new-athlete@repone.test`, password `Repone1234!`.

## 3. Drive

The harness is the **Chrome DevTools MCP** tools (`mcp__chrome-devtools__*`; load them with ToolSearch if deferred). If they are unavailable, say so and report browser recipes as not run — do not substitute curl for a UI proof.

- **One browser context per role.** `new_page` with `isolatedContext: "verify-<role>"` (e.g. `verify-scorekeeper`). Contexts don't share cookies, so two roles can be signed in side by side. Reuse the page id it returns.
- **Sign in (staff).** `new_page url=http://localhost:3200/login` → `take_snapshot` → `fill_form` the `Email` and `Password` textboxes → `click` the `SIGN IN` button. Each role lands on its own screen (`/admin`, `/scorekeeper`, `/producer`, `/commentator`); an athlete who uses this form lands on `/athlete`.
- **Start page.** There is one door, `/login` (athletes too; `/athlete/login` redirects to it). After sign-in `/` is the start page with a card per module the account may open; an athlete-only account goes straight to `/athlete`. Verification, reset and invitation emails are read in Mailpit at `http://127.0.0.1:54524` (API: `/api/v1/messages`).
- **First visit of a route compiles it** (5-30s on a cold server). Pass `timeout: 60000` to `new_page` / `navigate_page`; a 10s timeout leaves you snapshotting a blank page.
- **Find elements by `take_snapshot`, act by uid.** Accessible names come from the snapshot (headings, labels, button text — many render uppercase, e.g. `SAVE SCORE`). Take a fresh snapshot after every navigation or save; uids change.
- **Confirm dialogs.** Destructive and finishing actions use `window.confirm` (e.g. *Finish Heat*). The `click` call reports "Open dialog … Call handle_dialog": answer with `handle_dialog action=accept`, then continue.
- **Native date inputs** don't accept `fill` per segment. Set them with `evaluate_script`: `(el) => { el.value = "1980-01-15"; }` via `args: [uid]`, or set `input[name=...]` directly and submit the form.
- **Public pages** (`/live/...`, `/overlay/...`) need no login; open them in a fresh `isolatedContext: "verify-anon"` so no staff cookie leaks in.
- **Database side effects** (the proof behind a UI change): `./.claude/skills/verify-repone/scripts/q.sh "select ..."`. It uses a local `psql` when installed (fast), else psql inside the db container. Read-only queries only, except the documented fixture resets.

## 4. Evidence

```bash
dir=$(./.claude/skills/verify-repone/scripts/evidence.sh <feature-id>)   # e.g. scoring
```

Creates `.verify/<timestamp>-<feature-id>/` with `run.txt` (branch, commit, dirty flag). `.verify/` is gitignored because screenshots show athlete names. Save into it:

- `take_snapshot filePath=$dir/<step>.aria.txt` and `take_screenshot filePath=$dir/<step>.png` for the action AND the resulting state (before/after), not just the final screen.
- The DB side effect: `scripts/q.sh "<select>" > $dir/<step>.db.txt` (rows written, standings, flags).
- Any server error: the relevant tail of `.verify/run/dev.log` (or the reused server's terminal).

Proof standards:

- Drive the real user path (forms, buttons, the role's own login). Never call server actions, RPCs, or the REST API directly to "prove" a UI feature, and never set state with SQL except via `fixtures.sh` resets named in a recipe.
- Verify the side effect, not only the screen: a saved score is a `results` row AND a recomputed `standings` row AND the public leaderboard showing it.
- Cross-check from a second viewpoint when the feature is shared: what the scorekeeper saved must appear on `/live` (anonymous context) and the overlay.
- A recipe's listed entry points are all in scope. If one can't be reached, report it as skipped with the reason; don't count another path as covering it.

## 5. Cleanup

```bash
./.claude/skills/verify-repone/scripts/app.sh stop
```

- Stops only the server this run started (pid recorded in `.verify/run/dev.pid`); a reused server and the Supabase stack keep running. Never `pkill next`/`node` — another checkout or the user's own session may be on the machine.
- Close the pages you opened (`close_page`) so role cookies don't leak into the next run.
- Restore fixtures a recipe mutated with its reset command (e.g. `fixtures.sh reset-scoring`).
- Evidence in `.verify/<timestamp>-<feature-id>/` is never deleted by cleanup. Check it still exists before reporting.

## Helpers

| Command | What it does |
|---|---|
| `scripts/app.sh start\|status\|stop` | Launch or reuse the :3200 server; report ownership; stop only what this run started |
| `scripts/doctor.sh` | Read-only health check, prints a fix per failure |
| `scripts/fixtures.sh [show]` | Logins, seed ids, URLs |
| `scripts/fixtures.sh reset-scoring` | Clear results/standings for the seed heat and un-finish it |
| `scripts/fixtures.sh reset-onboarding` | Make `new-athlete@repone.test` not onboarded again |
| `scripts/evidence.sh <feature-id>` | Make and print this run's evidence folder |
| `scripts/q.sh "<sql>"` | One read query against the local DB (local psql, else inside the db container) |

Related automated checks (not browser proof, but run them when access rules or standings change): `pnpm db:rls-check`, `pnpm db:standings-check`.
