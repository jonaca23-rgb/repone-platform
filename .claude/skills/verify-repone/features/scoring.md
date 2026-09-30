# Score a heat

A scorekeeper records each lane's result for the current heat, finishes the heat, and the division's WOD and overall standings update on the public leaderboard and the leaderboard overlay.

## Sub-features

- `score-lane` saves one lane's result (time, capped + reps, tie-break, status).
- `score-nonfinish` records DNF / DNS / DQ; they rank after every finisher (finishers + 1 points), never as a win.
- `score-midwod` while a WOD's heats are unfinished, competitors yet to compete are not on the overall board.
- `score-finish` *Finish Heat* marks the heat completed and recomputes overall standings (missing results count as last once the WOD's heats are all finished). Disabled while any lane is unsaved.
- `score-unsaved` a lane with typed-but-unsaved values shows `● UNSAVED`; while any exist the screen stays on that heat even if Production moves on, with a notice.
- `score-live` the public `/live/<event>` leaderboard shows the recomputed overall standings.
- `score-follow` "Following live heat" switches the scorekeeper to the heat Production selects.

## How to get to it (user POV)

- Sign in at `/login` as `scorekeeper@repone.test` → lands on `/scorekeeper` → choose the event and floor → `/scorekeeper/<floorId>`.
- Admin: the `SCORE KEEPER →` link in the admin header, same screen.
- Backup path: admin → event → Heats & Lanes → a heat's detail page has its own per-lane entry and "Save All" (does not finish the heat).
- Viewers: `/live` → the event → Leaderboard (no login).

## Driving it with Chrome DevTools MCP

Preconditions:

- `doctor.sh` exits 0.
- `fixtures.sh reset-scoring` has run (seed heat has no results and is not finished).
- Evidence folder: `dir=$(scripts/evidence.sh scoring)`.

- **Sign in.** `new_page url=http://localhost:3200/login isolatedContext=verify-scorekeeper`, `fill_form` Email `scorekeeper@repone.test` / Password `Repone1234!`, `click` `SIGN IN`. The page lands on `/scorekeeper`.
- **Open the floor.** `navigate_page url=http://localhost:3200/scorekeeper/00000000-0000-0000-0000-000000000030`. Snapshot shows `APRIETA ENTRY LEVEL`, `WOD 2 · HEAT 6 / 9`, `INTERMEDIATE FEMALE`, and six lane forms: `MARIA RIVERA`, `SOFIA DELGADO`, `CAMILA ORTIZ`, `VALENTINA CRUZ`, `ISABELLA VEGA`, `GABRIELA TORRES`.
- **Save two finishers.** In lane 1 `fill` textbox `TIME (MM:SS)` = `5:00`, `click` that lane's `SAVE SCORE`; lane 2 `5:10`, `SAVE SCORE`. DB: `scripts/q.sh "select athlete_id, time_seconds, status from results where heat_id='00000000-0000-0000-0000-000000000070'"` shows 300 and 310, `completed`.
- **Save a DNF.** Lane 6 `fill` combobox `STATUS` = `DNF`, `click` its `SAVE SCORE`. DB: a `dnf` row with no time.
- **Mid-WOD board (score-midwod, score-nonfinish).** `scripts/q.sh "select a.first_name, s.placement, s.points from standings s join athletes a on a.id=s.athlete_id where s.division_id='00000000-0000-0000-0000-000000000040' and s.wod_id is null order by s.points"` → Maria 1/1, Sofia 2/2, Gabriela 3/3. Lanes 3-5 are absent (not yet competed).
- **Save the rest.** Lanes 3-5: `5:20`, `5:30`, `5:40`, each with its own `SAVE SCORE`.
- **Finish the heat.** First `take_snapshot` and check every lane shows `✓ RECORDED` (saves run one at a time; a Finish clicked while saves are queued waits behind them). Then take a fresh `take_snapshot` and `click` `FINISH HEAT` → dialog `Finish Heat 6 — WOD 2 (Intermediate Female)?` (plus `N lanes have no result…` when some are missing) → `handle_dialog accept`. DB: `scripts/q.sh "select ended_at is not null from heats where id='00000000-0000-0000-0000-000000000070'"` → `t`; overall standings 1-5 by time, Gabriela 6th with 6 points.
- **Public leaderboard.** `new_page url=http://localhost:3200/live/00000000-0000-0000-0000-000000000010 isolatedContext=verify-anon`. Under `LEADERBOARD` → `INTERMEDIATE FEMALE`: places 1-6 Maria, Sofia, Camila, Valentina, Isabella, Gabriela with points 1-6.
- **Proof.** Before/after: `take_screenshot filePath=$dir/scorekeeper-saved.png` after the lane saves, `$dir/live-leaderboard.png` + `take_snapshot filePath=$dir/live-leaderboard.aria.txt` at the end, and the two standings queries into `$dir/standings-midwod.db.txt` / `$dir/standings-final.db.txt`.
- **Reset.** `scripts/fixtures.sh reset-scoring`.

## Gotchas

- Server actions from one page run one at a time. While lane saves are in flight the finish button reads `FINISHING…` for several seconds; poll the DB (`ended_at`), don't re-click.
- **`FINISH HEAT` does not save lanes.** It reads `SAVE N UNSAVED LANES FIRST` (disabled) until every lane is saved with its own `SAVE SCORE`.
- Take a fresh snapshot before clicking `FINISH HEAT`: after saves the page refreshes and an old uid can land on another control.
- Every lane form has identical labels (`TIME (MM:SS)`, `STATUS`, `SAVE SCORE`). Pick uids by the lane number / athlete name that precedes them in the snapshot.
- The first save after a cold start can take 30s+ (route compile + auth refresh). Wait for the DB row, not a fixed sleep.
- "Following live heat" switches to whatever heat Production selects, except while lanes are unsaved (the screen holds its heat and shows `Production moved to …`). To test that, type without saving, then click `NEXT HEAT →` on the dashboard in another context.
- A DNF has placement empty on the WOD board but points (finishers + 1) on the overall board — assert overall, not the WOD row's placement.
- The QA circuit's standings were precomputed by the seed and aren't recomputed until someone scores that division; don't use them as proof of scoring rules.
