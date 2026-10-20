# Scorekeeper — Design

**Date:** 2026-10-04
**Status:** design approved in conversation; awaiting review of this written spec.
**Branch:** `feat/scorekeeper-redesign`, from `feat/admin-details` (#22 is still open). The PR targets `staging`.
**Sub-project 3 of 7** from the UI/UX audit (`.impeccable-audit/AUDIT.md`). It builds on the foundations from sub-project 2 (`2026-10-04-admin-data-screens-design.md`): `ActionResult`, `safeAction`, `useServerAction`, `ResponsiveDialog`, `ConfirmAction`, `FormField` and `FormAlert`.

## Goal

A judge on the floor enters a lane's score with one thumb, on a phone, in seconds, without iOS zooming in and without hunting for a colon on the keypad. The same entry is used everywhere a result is typed.

**Success means:**
- On a 390-wide phone, the heat header and the finish bar stay on screen while the lane list scrolls, and at least six lanes are visible without scrolling.
- Every target is at least 44px. Every input's text is at least 16px.
- A for-time score is entered as minutes and seconds in two numeric fields. No field needs a colon.
- A failed save keeps the drawer open and shows the message next to the field that caused it.
- The scorekeeper screen and the admin heat's Results tab use the same lane list and drawer. `saveHeatResults` and `ResultsForm` are gone.
- `enterResult` and `finishHeat` return `ActionResult`, and `heats.ts` and `results.ts` are on `ACTION_RESULT_FILES`.

## Non-goals

- Scoring rules, standings computation, permissions, the database.
- Team results. Today's scorekeeper and admin form only score athletes (`competitor_type="athlete"`); that stays.
- The scorekeeper's event and floor pickers (`/scorekeeper`, `/scorekeeper/events/[eventId]`). They are already short, labelled lists.
- Notes on a result. Neither screen shows them today.

## 1. Layout

### Scorekeeper floor screen (`/scorekeeper/[floorId]`)

Three bands, one column, `max-w-3xl`:

1. **Sticky heat header** (top). Line 1: `WOD 2 · HEAT 6 / 9` and the connection indicator (dot plus the word "Live" or "Reconnecting…"). Line 2: the division. Line 3: the heat switcher — an icon button for the previous heat, the heat Select (fills the row), an icon button for the next heat — followed by either the "Following live" status or the "Follow live" button. The previous and next buttons have `aria-label`s. A finished heat shows a "Finished" badge on line 1.
2. **Lane list.** One row per laned athlete, in lane order. A row is a button that opens the drawer. It shows the lane number, the athlete's name, the affiliate (muted, one line, truncated), the score summary (§3) right-aligned in tabular figures, and one state badge: **Recorded**, **Pending** (no result yet) or **Adjusted** (`manually_adjusted`). The row is at least 56px tall. Lanes with no athlete are not listed. When no lane has an athlete, the empty state from today stays.
3. **Sticky finish bar** (bottom, with `env(safe-area-inset-bottom)` padding). Left: `5 / 8 recorded`. Right: a **Leaderboard** button that opens a Sheet, and **Finish heat** (§4). On a finished heat, the finish button reads "Heat finished" and is disabled.

The empty "no heats on this floor" state stays as it is.

### Admin heat detail, Results tab

The Results tab renders the same lane list (§2) with no sticky header, no follow-live and no finish bar. The explanatory line stays: saving here doesn't finish the heat. Admin has no "finish" control, as today.

## 2. The lane list and the score drawer

Shared components in `src/components/scoring/`:

- `LaneList` — the rows. Props: `heat` (id, number, scoring type, lanes), `resultsByAthlete`, `onOpen(lane)`. No data fetching.
- `ScoreDrawer` — a `ResponsiveDialog` (Drawer under `sm`, Dialog above). Props: `heatId`, `lane`, `existing`, `scoringType`, `open`, `onOpenChange`, plus an optional `notice` (a line shown above the form, used for the held-back message in §5).
- `LaneScoring` — composes the two for the admin tab: holds which lane is open and renders `LaneList` plus `ScoreDrawer`. The scorekeeper screen composes them itself, because it also owns the held-back logic.

### The drawer's form

Title: `Lane 3 · Carla Ortiz`. Description: the WOD and division.

1. **Status**, a ToggleGroup (single, required): Completed, DNF, DNS, DQ. Each item has `aria-pressed` from Radix. A hidden `status` input carries the value. When the status is not Completed, the score fields are hidden (the server ignores them for DNS/DNF/DQ already).
2. **Score fields**, by scoring type:
   - `for_time`: **Minutes** and **Seconds**, two inputs side by side with a colon glyph between them (`aria-hidden`). Minutes: `inputMode="numeric"`, digits only. Seconds: `inputMode="decimal"` (a judge may type `12.5`). The form posts a hidden `time_seconds` built by `joinClock(min, sec)` (§3); blank minutes and blank seconds post blank. A **Time-capped** Switch follows; when on, a **Reps** field appears.
   - `amrap`: **Total reps** (`numeric`).
   - `max_load`: **Load** (`decimal`, step 0.5).
   - `points` and `other`: **Points** (`decimal`).
3. **More** (a disclosure, closed unless the saved result already has a tie-break or is adjusted): **Tie-break** (`decimal`) and the **Manual adjustment** Switch with its help text.
4. **Save lane** (full-width, `size="touch"`) and Cancel in the footer.

All inputs are `h-12 text-base` or larger (16px, no iOS zoom). The first score field gets focus on open.

Each field goes through `FormField`, so a server `fieldErrors` entry shows under its field. A `time_seconds` error shows under the minutes/seconds pair. A form-level failure shows in `FormAlert` at the top of the form.

### Saving

`useServerAction((fd) => enterResult(heatId, fd), { success: \`Lane ${n} saved\` })`. On success the drawer closes and the router refreshes (the row's summary and badge update). On failure the drawer stays open with the values the judge typed.

### Unsaved changes

The drawer tracks whether any field changed since it opened (`onInput` on the form, plus `onValueChange`/`onCheckedChange` on the ToggleGroup and Switches). Closing a changed drawer — Cancel, Escape, the overlay or a swipe down — opens a `ConfirmAction`: "Discard changes to lane 3?" with **Discard** and **Keep editing**. An unchanged drawer closes at once.

This replaces today's per-lane "unsaved" set: only one lane can be open, so only one lane can hold unsaved values.

## 3. Formatting helpers

`src/lib/scoring/format.ts`, pure and unit-tested:

- `splitClock(seconds: number | null): { minutes: string; seconds: string }` — `225` → `{ "3", "45" }`; `225.5` → `{ "3", "45.5" }`; `null` → `{ "", "" }`. Seconds are zero-padded to two digits before any decimal.
- `joinClock(minutes: string, seconds: string): string` — `("3", "45")` → `"3:45"`; `("", "45")` → `"0:45"`; `("3", "")` → `"3:00"`; `("", "")` → `""`. Trims. It does not validate; `field.clock` on the server does.
- `scoreSummary(result, scoringType): string` — the row's summary:
  - no result → `—`;
  - status DNS/DNF/DQ → `DNS` / `DNF` / `DQ`;
  - `for_time`: capped → `CAP 87` (reps; `CAP` alone when reps is null), else `formatClock(time_seconds)`;
  - `amrap` → `87 reps`;
  - `max_load` → `120` (the load, no unit — the app has no unit setting);
  - `points`/`other` → `42 pts`;
  - a completed result whose number is null → `—`.

## 4. Finishing a heat

**Finish heat** opens a `ConfirmAction`: title `Finish Heat 6?`, description `WOD 2 (Intermediate Female) is marked completed.` plus, when lanes have no result, `3 lanes have no result and will count as last once the WOD is finished.` It calls `finishHeat(heatId)`; success toasts the server's message, "Heat 6 finished."

Today the finish button refuses while lanes are unsaved. With the drawer modal, the finish bar can't be reached while a lane is being edited, so that check goes.

## 5. Following the live heat

Unchanged in behaviour, simpler in state:

- `following` (default true) and `manualHeatId` as today. The active heat is the live heat while following, else the picked heat.
- While a drawer is open, the active heat is **held** on the drawer's heat. If Production moves the live heat meanwhile, the drawer shows a `notice`: `Production moved to WOD 2 · Heat 7. You'll go there when you close this lane.` Closing the drawer (saved or discarded) releases the hold, and a follower lands on the live heat.
- Switching heats (picker, previous, next, Follow live) is only possible with the drawer closed, so the "Leave this heat?" dialog goes.

## 6. Leaderboard

The **Leaderboard** button opens a `Sheet` (`side="bottom"` under `sm`, `side="right"` above) titled `Leaderboard — WOD 2 (Intermediate Female)`. It holds a `Table`: Place, Athlete, Points, with tabular figures. An empty standings list shows "No scores yet." The data is the `standingsByHeatId` the page already loads.

## 7. Actions

### `enterResult(heatId: string, formData: FormData): Promise<ActionResult>`

The unused `eventId`, `wodId`, `divisionId`, `scoringType` and `floorId` parameters go (the server already reads them from the heat). The body is wrapped in `safeAction`. "That competitor isn't in this heat." stays a `NotAuthorizedError`, which `toFailure` turns into a failure. A validation error returns its `fieldErrors`. Returns `ok()`; the client's success message names the lane.

### `finishHeat(heatId: string): Promise<ActionResult>`

Same parameter cleanup, wrapped in `safeAction`, returns `okMessage(\`Heat ${heat.heat_number} finished.\`)`. `requireHeatAccess` (via `heatScope`) doesn't return `heat_number`, so the update's `.select("id, heat_number")` supplies it; the guard stays unchanged.

### Removed

`saveHeatResults`, `laneFields`, `ResultsForm.tsx`, and the `saveHeatResults` tests in `heatDetail.test.ts`. The comment in `heats.ts` that points at "Save All" is updated.

### Guard

`src/lib/actions/heats.ts` and `src/lib/actions/results.ts` join `ACTION_RESULT_FILES`.

## 8. New UI primitive

`toggle` and `toggle-group` from shadcn (`radix-vega`), added with the shadcn CLI and kept as generated except for a `size="touch"` variant (min height 44px) if the generated sizes are smaller.

## 9. Testing

- **Unit:** `splitClock`, `joinClock`, `scoreSummary` (every branch in §3).
- **Actions** (with `fakeSupabase`): `enterResult` returns a failure for a competitor outside the heat, returns `fieldErrors.time_seconds` for `"3:7x"`, and returns `ok` and upserts for a valid card. `finishHeat` returns the "finished" message, and a failure when the heat row doesn't change.
- **Components** (jsdom): `ScoreDrawer` posts `time_seconds="3:45"` from minutes 3 and seconds 45; hides score fields when DNF is pressed; asks before discarding a changed form and closes an unchanged one at once; shows a returned field error under minutes/seconds. `LaneList` shows Recorded, Pending and Adjusted correctly.
- **Guard:** `pnpm ui:guard` passes with the two files added.
- **Browser** (screenshots saved to `.verify/scorekeeper/`): at 390×844, 390×400 (keyboard up: Save lane visible and works) and 820×1180 — enter a for-time score, a capped score, a DNF; fail a save (bad seconds) and see the field error; finish a heat; open the leaderboard; enter a score from the admin Results tab. Test data is cleaned from the local DB afterwards, and browser pages are closed.
- **Lighthouse** accessibility ≥ 95 on the floor screen, mobile.

## 10. Docs

`DESIGN.md` gets a short "Entering scores" note under the admin guide: use `LaneScoring` (or `LaneList` + `ScoreDrawer`) wherever a result is typed; never a second entry form.
