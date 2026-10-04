# Production board — Design

**Date:** 2026-10-04
**Status:** design approved in conversation (with both new confirmations and the Broadcast tab's removal); awaiting review of this written spec.
**Branch:** `feat/production-board`, from `staging`. The PR targets `staging`.
**Sub-project 4 of 7** from the UI/UX audit (`.impeccable-audit/AUDIT.md`). It builds on sub-project 2 (`ActionResult`, `safeAction`, `DataTable`, `ConfirmAction`) and sub-project 3 (`scoreSummary` in `src/lib/scoring/format.ts`).

## Goal

A producer running a live floor on a tablet sees everything that is on air in one glance and reaches every control without scrolling. Two things should be hard to do by accident: restarting the clock mid-heat and switching heats while it runs. The producer's read-only tabs read like admin's: tables, not stacks of cards.

**Success means:**
- At 1024×768 (tablet landscape), the On air bar, the heat, the timer controls and every graphic, lower-third and sponsor control are visible without scrolling.
- The On air bar always says what the audience sees: the heat (or that none is on air), the timer value and state, the graphic, the lower third and the sponsor.
- **Start** asks first when the timer isn't idle. **Previous/Next heat** asks first when the timer is running or paused.
- A failed control shows the server's own message in the board's alert, not a generic one.
- Every action in `src/lib/actions/broadcast.ts` returns `ActionResult`, and the file is on `ACTION_RESULT_FILES`.
- The Broadcast tab is gone, and `/producer/events/[id]/broadcast` redirects to `/production`.
- Scores is a `DataTable` showing each result's score. Heats, Sponsors and Commentary are tables.

## Non-goals

- What a graphic looks like on air, or the overlays themselves (sub-project 7).
- Timer semantics: `timer_command()` stays the authority.
- The broadcast state schema, permissions, and the operator log.
- The Overview tab (it is already counts plus links).
- The commentator's own screens (sub-project 5). They share `EventHeatsList`, so they get the Heats table for free.

## 1. The board layout

`DashboardClient` renders both `/producer/events/[id]/production` (through `EventProducerProduction`, which adds floor tabs) and `/dashboard/[floorId]`. The layout changes only in `DashboardClient`.

```
┌─ ON AIR (sticky) ────────────────────────────────────────────────┐
│ ● Live  WOD 2 · Heat 6/9 · Int. Female   ⏱ 07:42 Running          │
│ Graphic: Lanes · Lower third: Maria Rivera · Sponsor: Hoka [Clear]│
├──────────────────────────────┬───────────────────────────────────┤
│ HEAT                         │ GRAPHICS                          │
│ TIMER                        │ LOWER THIRD                       │
│                              │ SPONSORS                          │
└──────────────────────────────┴───────────────────────────────────┘
```

- **Width:** the container is `max-w-7xl`. From `lg` (1024px) the body is a two-column grid, `grid-cols-[minmax(0,1fr)_minmax(0,1fr)]`, with `gap-4`.
  - **Left column ("the floor"):** the Heat section, then the Timer section.
  - **Right column ("the audience"):** the Graphics section, then Lower third, then Sponsors.
- **Below `lg`:** one column in the same order: Heat, Timer, Graphics, Lower third, Sponsors.
- **Sections** stay `Section` cards with an `h2`.
- **Compact sizes, so the whole board fits at 1024×768:**
  - Live controls are `min-h-14` (56px), down from 64px.
  - The timer display is a smaller size of `TimerDisplay` (§3).
  - The lanes list is a compact 3-column grid on the left.

  56px is still above the 44px floor.

## 2. The On air bar

A new `OnAirBar` component (`src/app/(app)/dashboard/[floorId]/OnAirBar.tsx`) is `sticky` under the shell header. It uses the shell's offset, `top-[calc(3.5rem+env(safe-area-inset-top))]`, on screens at least 600px tall, as on the scorekeeper (`[@media(min-height:600px)]:sticky`). The producer's event tabs sit under the shell header but aren't sticky, so the 3.5rem header is the only thing above the bar. It has `role="region"` and `aria-label="On air"`.

**Line 1:**
- the connection dot plus "Live" or "Reconnecting…";
- the heat on air: `WOD 2 · Heat 6 / 9 · Intermediate Female`, or **"No heat on air"** in the warning colour;
- the timer value (`formatClock` of the live display seconds, tabular figures) and its state as a word: Idle / Running / Paused / Ended;
- "Sending…" while a control runs.

**Line 2:**
- `Graphic:` and the active graphic's label, or "None";
- `Lower third:` and the athlete's name, or "None";
- `Sponsor:` and the sponsor's name, or "None";
- at the end, **Clear all**: the existing confirmed Clear graphics, moved here.

**Name resolution, all client-side from props:**
- The lower-third name comes from `lower_third_athlete_id`, looked up across every heat's lanes on this floor.
- The sponsor name comes from `active_sponsor_id`, looked up in `sponsors`.
- An id that doesn't resolve shows "On air". That happens when an athlete is no longer laned or a sponsor was deactivated.

**No heat on air** (`heatOnAir(...).onAir === false`): line 1 shows the warning, and the bar gets a primary **Put Heat N on air** button. This replaces today's separate banner.

**Failures:** the board's existing dismissible `role="alert"` banner moves directly under the bar.

On a phone, each line wraps. Labels shorten to `GFX`, `L3` and `Sponsor`, with `aria-label`s carrying the full words.

## 3. Controls

### Heat

- The heading reads `WOD 2 · Heat 6 / 9` with the division under it.
- Previous and Next are icon-plus-label buttons on one row.
- The lanes are listed in a 3-column grid of number plus name.

**Heat switch confirmation.** When `timer_status` is `running` or `paused`, Previous/Next open a `ConfirmAction`:
- title: `Switch to Heat 7?`
- description: `The timer is running for Heat 6. Switching heats doesn't stop it.` (with `paused` instead of `running` when paused)
- confirm label: `Switch heat`
- `variant="default"`

When the timer is `idle` or `ended`, the switch happens at once, as today. "Put Heat N on air" never asks, because nothing is on air.

### Timer

- `TimerDisplay` gets an optional `size?: "default" | "board"` prop. `"board"` uses `text-5xl` with `px-6 py-3` (the default is `text-7xl px-10 py-6`), so it fits the left column at 1024×768. Every other caller keeps the default.
- The Direction toggle (Count down / Count up) becomes a `ToggleGroup` (single, `variant="outline"`, `size="touch"`, labelled "Timer direction"). Its value is local state, as today.

**Start:**
- When `timer_status` is `idle` or `ended`: start at once.
- Otherwise, open a `ConfirmAction` with title `Restart the timer?`, description `The clock is at 07:42. Restarting sets it back to the start, on the board and on air.`, confirm label `Restart timer`, `variant="default"`.

**The other controls:**
- Pause/Resume, Reset (already confirmed) and −10s/+10s keep their behaviour.
- Reset's description stays.

### Graphics, Lower third, Sponsors

- Behaviour is unchanged: toggle buttons with `aria-pressed`, the lower-third Select plus Show/Hide, and sponsor toggles.
- The Graphics grid is 3 columns from `sm`.
- Clear graphics leaves this section; it lives in the On air bar.

## 4. Actions: `broadcast.ts` on `ActionResult`

The new signatures:
- `setCurrentHeat(floorId, heatId)`
- `setActiveGraphic(floorId, graphic)`
- `setLowerThird(floorId, athleteId | null)`
- `setActiveSponsor(floorId, sponsorId | null)`
- `clearGraphics(floorId)`
- `startTimer(floorId, direction, durationSeconds)`
- `pauseTimer(floorId)`
- `resumeTimer(floorId)`
- `resetTimer(floorId)`
- `adjustTimer(floorId, deltaSeconds)`

How they change:
- The ignored `_eventId` parameter is removed from every one.
- Each returns `Promise<ActionResult>` and wraps its body in `safeAction`.
- `parseArg` and the guards still throw; `safeAction` converts them.
- `updateBroadcastState`'s "not available to your account" case stops throwing a literal message. It returns a boolean, and the caller returns `fail("This floor's broadcast controls aren't available to your account.")`.
- `throw new Error(error.message)` for database errors stays.
- Every action returns `ok()`. The board shows no success toasts: the On air bar is the confirmation.
- `src/lib/actions/broadcast.ts` joins `ACTION_RESULT_FILES`.

**On the board,** `go(what, action)` becomes a helper that awaits the `ActionResult`:
- on failure it sets the alert to `result.message`;
- a thrown error (network) keeps today's `failureMessage(what, e)`.

The confirmed controls pass the action straight to `ConfirmAction`, which already toasts a returned failure and stays open.

## 5. Producer tabs

- **Broadcast:**
  - Removed from `TABS` in `producer/events/[eventId]/layout.tsx`.
  - `broadcast/page.tsx` becomes `redirect(\`/producer/events/${eventId}/production\`)` (Next's `redirect` from `next/navigation`), so old links still work.
  - Its `loading`/`error` files, if any, go with it.
- **Scores:** a `ScoresTable` client component (module-scope columns, `DataTable`):
  - columns:
    - **Competitor**: the athlete's name or the team's name, searchable;
    - **WOD**, filterable, low priority;
    - **Heat** (`Heat 6`), sortable by heat number;
    - **Division**, filterable, low priority;
    - **Score**: `scoreSummary(result, scoringType)`, tabular;
    - **Status**: the badge for completed vs DNF/DNS/DQ, filterable, plus an **Adjusted** badge when `manually_adjusted`;
    - a row-actions column whose only item is **Correct on Score Keeper**, a link to `/scorekeeper/<floorId>`.
  - The page passes rows built from the results query. The query adds the `wods.scoring_type` it needs.
  - Search: "Search scores", placeholder "Search by athlete or team…".
  - Initial sort: WOD, then heat number.
  - Empty state: unchanged.
- **Heats:** `EventHeatsList` renders, per floor, an `h2` (`Venue — Floor`) and a shadcn `Table` with these columns:
  - **Heat** (`WOD 2 · Heat 6 / 9`);
  - **Division**;
  - **State**: a `Live` badge for the on-air heat, `Finished` when `endedAt`, else `—`.

  The on-air row gets `data-state="selected"` styling. It isn't a `DataTable`: one floor rarely has more than a few dozen heats, and it needs no search. The commentator's Heats tab uses the same component and changes with it.
- **Sponsors and Commentary:** each list becomes a shadcn `Table`.
  - Sponsors: Name, Tier badge.
  - Commentary: Name, Role badge.

  Short lists, so no `DataTable`.

## 6. Testing

**Actions** (`fakeSupabase`, mocked `requireFloorAccess`):
- `setCurrentHeat` returns `fail` for a heat not on the floor;
- `setActiveGraphic` returns `ok`;
- an update matching no row returns the "not available to your account" failure;
- `startTimer` with a bad duration returns its validation message;
- `clearGraphics` returns `ok`.

**Pure helpers** in `src/app/(app)/dashboard/[floorId]/onAir.ts`:
- `onAirSummary(state, heats, sponsors)` returns `{ heatLabel | null, graphicLabel, lowerThirdName, sponsorName, timerStateLabel }`, covering:
  - nothing on air;
  - everything on air;
  - an unresolved athlete or sponsor id ("On air").
- `needsRestartConfirm(status)` and `needsHeatSwitchConfirm(status)` are tested for every `timer_status`.

**Components** (jsdom):
- the On air bar shows "No heat on air" plus the Put-on-air button when nothing is on air;
- with the timer running, Next heat opens the confirmation instead of calling `setCurrentHeat`, and confirming calls it;
- with the timer idle, Next heat calls it at once;
- Start with the timer running asks first;
- a returned failure shows its message in the alert.

**Producer tabs:** `ScoresTable` shows `03:45` for a for-time result and filters by status.

**Guard:** `pnpm ui:guard` passes with `broadcast.ts` added.

**Browser** (screenshots to `.verify/production/`), signed in as the producer dev account:
- at **1024×768**: the whole board with no vertical scroll (`board-1024.png`);
- at **1440×900** (`board-1440.png`) and **390×844** (`board-390.png`);
- put a heat on air;
- show a graphic, a lower third and a sponsor, and check the On air bar names them;
- start the timer, then press Start again and see the restart confirmation;
- press Next heat while it runs and see the switch confirmation;
- Clear all;
- the Scores, Heats, Sponsors and Commentary tabs;
- `/broadcast` redirects;
- Lighthouse accessibility ≥ 95 on the Production tab (desktop and mobile).

Afterwards, reset the floor's `broadcast_state` and the timer in the local DB and close the browser pages.

## 7. Docs

`DESIGN.md` gets a short "Live control boards" note: an On air bar that names what the audience sees, two columns ("the floor" | "the audience") from `lg`, and live controls at least 56px. Confirm only what would hurt on air: restart, heat switch while timing, reset, clear.
