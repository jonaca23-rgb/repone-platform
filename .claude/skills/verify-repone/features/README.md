# RepOne verification map

This directory is the maintained source for verifying RepOne's user-facing behavior. Read this index before driving the app, then use the matching feature file as the recipe. The harness is the Chrome DevTools MCP tools plus the helpers in `../scripts/`, as described in `../SKILL.md`.

## Baseline preconditions

- Launch with `scripts/app.sh start` (reuses this checkout's :3200 server, or runs `pnpm dev`).
- `scripts/doctor.sh` exits 0: local Supabase up, all migrations applied, seed event + QA circuit + 6 dev accounts present, :3200 served by this checkout.
- Logins: `admin@`, `scorekeeper@`, `producer@`, `commentator@`, `athlete@`, `new-athlete@repone.test`, password `Repone1234!` (`scripts/fixtures.sh` prints them with the seed ids).
- The seed event `Aprieta Entry Level` (floor `…030`, division `…040`, heat `…070`, lanes 1-6) is shared fixture data; recipes that mutate it name their reset.
- Never drive a server on :3200 that doctor reports as another checkout's.

## Driving conventions

- One `isolatedContext` per role (`verify-admin`, `verify-scorekeeper`, `verify-producer`, `verify-athlete`, `verify-anon`).
- Act on uids from a fresh `take_snapshot`; match by accessible name, label or heading text — many render uppercase in the snapshot.
- Destructive and finishing actions confirm in an in-page dialog: click the trigger, then the dialog's confirm button by its label (see `../SKILL.md`, Confirm dialogs). Use `handle_dialog` only for a native `alert`/`confirm`, which the UI no longer uses.
- Staff land on `/` (start page); admin has a sidebar; producer, scorekeeper and commentator have an operator shell with event tabs; athletes have a bottom tab bar on phones. Org members are **Members** in the UI (`/admin/team`).
- Check side effects with `scripts/q.sh "<select>"` — read-only, except the resets a recipe names.
- Start every recipe from the baseline; restore what it changed.

## Proof and skip reporting

- Make the folder with `scripts/evidence.sh <feature-id>`; it survives `app.sh stop`.
- Capture the user action and the resulting state (before/after screenshots + ARIA snapshot), plus the DB side effect.
- Shared data must be proven from a second viewpoint: scorekeeper → `/live`; dashboard → overlay page.
- Record the sub-feature IDs and entry points you actually drove.
- Report an unreachable path with the attempted step and the unmet precondition; never count another path as covering it.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior, then exactly four H2 sections in this order: `Sub-features`, `How to get to it (user POV)`, `Driving it with Chrome DevTools MCP` (starting with `Preconditions:`, then labeled steps pairing a user action with the exact tool call and observable result), and `Gotchas`. Keep implementation details out; name user paths, stable handles, required state, commands and proof.

## Features

- [Score a heat](./scoring.md): scorekeeper lane entry, DNF/DNS/DQ, finishing a heat, overall standings, public leaderboard.
- [Run production and broadcast overlays](./production-overlays.md): heat selection, timer, graphics, lower third, sponsors, and the OBS overlay pages.
- [Role access and private athlete data](./access-control.md): role landing pages, the admin gate, private athlete data, and the OAuth redirect.
- [Athlete portal](./athlete-portal.md): sign-in, onboarding, lifts, directory, messaging, likes.
- [Set up an event](./event-setup.md): event, divisions, WODs, floors, registrations, generated heats, staff, fees and payments.
