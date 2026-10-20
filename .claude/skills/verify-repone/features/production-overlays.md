# Run production and broadcast overlays

A producer drives a floor's broadcast from the Production Dashboard (current heat, timer, graphics, lower third, sponsor), and the OBS browser-source overlays at `/overlay/<floorId>/*` update live with no login.

## Sub-features

- `prod-heat` *← Previous Heat* / *Next Heat →* sets the floor's current heat (every graphic follows it).
- `prod-timer` Count Down / Count Up, Start (also shows the timer graphic), Pause ↔ Resume, Reset, −10s / +10s.
- `prod-graphic` Show Heat Intro / Lanes / WOD / Timer / Leaderboard, and Clear Graphics.
- `prod-lower-third` pick a lane athlete, Show / Hide the lower third over any graphic.
- `prod-sponsor` toggle a sponsor card.
- `overlay-program` `/overlay/<floor>/program` renders whichever graphic is active.
- `overlay-standalone` `/timer`, `/heat`, `/lanes`, `/wod`, `/leaderboard`, `/lower-third`, `/sponsor` render their layer regardless of the active graphic.

## How to get to it (user POV)

- Sign in at `/login` as `producer@repone.test` → start page `/` → `Production` card → `/producer` ("Select an event to produce") → the event → event tab `Production`.
- `/dashboard` → "Select a Floor" → `/dashboard/<floorId>` (same controls).
- Admin: the account menu (avatar and name, sidebar footer) → `Production`.
- Overlays: `/overlay/<floorId>` lists every browser-source URL (no login).

## Driving it with Chrome DevTools MCP

Preconditions:

- `doctor.sh` exits 0. Seed floor `00000000-0000-0000-0000-000000000030` has one heat (Heat 6 / 9, lanes 1-6).
- No scoring run in progress (the scorekeeper screen follows the producer's heat).
- Evidence folder: `dir=$(scripts/evidence.sh production-overlays)`.

- **Sign in.** `new_page url=http://localhost:3200/login isolatedContext=verify-producer`, sign in as `producer@repone.test`. Lands on `/`, the start page with the `Production` card.
- **Open the dashboard.** `navigate_page url=http://localhost:3200/dashboard/00000000-0000-0000-0000-000000000030`. Header shows `WOD 2 · Heat 6 / 9` and `Intermediate Female`; six lane tiles.
- **Open the program overlay.** `new_page url=http://localhost:3200/overlay/00000000-0000-0000-0000-000000000030/program isolatedContext=verify-anon`. With nothing active it renders an empty transparent page.
- **Heat intro.** On the dashboard `click` `Show Heat Intro`. Program shows `WOD 2`, `Heat 6 of 9`, `Intermediate Female`. DB: `scripts/q.sh "select active_graphic from broadcast_state where floor_id='00000000-0000-0000-0000-000000000030'"` → `heat_intro`.
- **Lanes.** `click` `Show Lanes`. Program lists lanes 1-6 with the athlete names (Maria Rivera … Gabriela Torres).
- **Timer.** `click` `Count Down`, then `Start`. Program switches to the timer graphic and counts down from `15:00` (WOD 2's cap); `click` `Pause` (button becomes `Resume`), then `Reset`. DB: `timer_status` `running` → `paused` → `idle`.
- **Lower third.** In the Lower Third section `fill` the unlabeled select with `Lane 2 — Sofia Delgado`, `click` `Show`. Program shows `Sofia Delgado` and `Intermediate Female · Box 787` over the current graphic; `click` `Hide` removes it.
- **Clear.** `click` `Clear Graphics`. Program is empty again; `active_graphic` = `none`.
- **Proof.** For each step `take_screenshot filePath=$dir/program-<graphic>.png` of the overlay page (the dashboard screenshot alone doesn't prove the overlay updated), plus `take_snapshot filePath=$dir/dashboard.aria.txt`, and `scripts/q.sh "select active_graphic, timer_status, lower_third_athlete_id from broadcast_state where floor_id='00000000-0000-0000-0000-000000000030'" > $dir/broadcast_state.db.txt` after each change.

## Gotchas

- There is no heat picker: only Previous/Next. With no current heat set, the dashboard treats heat #1 as current while overlays show nothing — `click` `Next Heat →`/`← Previous Heat` or a Show button first.
- `Start` also switches the active graphic to the timer.
- `Show Score` has no program-overlay branch: program renders nothing for it. Not a regression of your change.
- Overlays load heats, lanes and sponsors once; only `broadcast_state` is live. After changing lanes or heats in Admin, reload the overlay page.
- Buttons fire without a pending state or error message; confirm every step via the overlay page or `broadcast_state`, never the button alone.
- The seed event has no sponsors: add one in `/admin/sponsors` first to drive `prod-sponsor`, and remove it afterwards.
- Reset the floor afterwards: `Clear Graphics`, `Hide` the lower third, `Reset` the timer.
