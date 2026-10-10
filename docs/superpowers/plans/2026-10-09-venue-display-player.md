# Venue Display Player (Venue Display Part B, revised) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed-out, portrait 9:16 venue screen rotates the event's sponsors with live info about the floor it follows: the current heat, the next heat and the leaderboard. Each sponsor gets inventory in proportion to its package weight. Producers create and configure displays from the event's Production area.

**Architecture:** This revises **Part B** of `docs/superpowers/plans/2026-10-02-venue-display-mvp.md`, which was written before the redesign and before Part A shipped (#29). The following are reused from that plan, with the changes below: the pure scheduler (B1), eligibility (B2), and the device migration and seed (B3). The data path, the stage, the blocks and the producer UI are redone on today's foundations.

**Tech Stack:** Next.js 16, React 19, Supabase (Postgres, RLS, Realtime), zod 4, Vitest, Tailwind 4.

**Spec:** `docs/specs/venue-display.md` (MVP: "Venue display", "Weighted scheduler", "Reliability"). Open client decisions 1–2 from the original plan apply here:
1. One display follows one floor.
2. Info blocks are eligible from data, not from an operator mode.

**Base:** branch `feat/venue-display`, on top of `feat/sponsor-packages` (#29, open). The PR targets `staging`.

## Changes from the original Part B

1. **Migration number.** It is `0033_display_devices.sql`. `can_manage_event_displays` uses `has_role(org, array['admin','event_director','production_director'])` or `is_event_producer`, both still valid. The publication adds `display_devices`, `display_blocks`, `event_sponsorships`, `sponsor_creatives`, `sponsor_packages` and `sponsors`. The realtime publication currently holds only broadcast_state, heats, lanes, messages, results and standings.
2. **Data path: server snapshot plus `router.refresh()`.** This replaces the client snapshot loader, `useTableChanges` and `useDisplaySnapshot`.
   - `loadDisplaySnapshot(displayId)` is server-only. It reads the device and its blocks, `getFloorContext(floor_id)` for the heats, and `getEventSponsors(event_id)`.
   - The player watches the tables through `useRefreshOnChanges` (its `table` union widens). A refresh keeps the player's client state (the scheduler) and only swaps props, so a change takes effect on the next item.
   - A failed refresh keeps the last render, which is the offline behaviour Part D builds on.
   - The current heat comes live from `useBroadcastState`, and the leaderboard live from `useDivisionStandings`, which is debounced and applies only the latest response.
3. **The stage.** `src/lib/broadcast/stage.ts` gains `fitStage(stage, width, height) → { s, x, y }`. The overlay's `stageScale` and `stageOffset` are kept and delegate to it.
   - `DisplayStage` is a 1080×1920 copy of the `BroadcastStage` pattern: opaque black, hidden until it has measured the viewport.
   - Transitions use `Appear` (`variant="fade"`), so reduced motion is respected.
4. **Display type scale.** These go in `globals.css` `@theme`, in stage px, and are read from 5–15 m away:

   | Token | Size |
   |---|---|
   | `--text-dp-hero` | 160px |
   | `--text-dp-title` | 96px |
   | `--text-dp-body` | 56px |
   | `--text-dp-label` | 40px |

   The blocks use the broadcast colours (`bg-broadcast-bg`, `text-broadcast-fg`, `text-broadcast-accent`).
5. **Producer UI.** It is a new **Displays** tab in the producer event layout, after Sponsors.
   - `DisplaysTable` is a `DataTable` with these columns:
     - **Display:** the name and floor.
     - **Active:** an `ActionSwitch`.
     - **Actions:** `RowActions` with Copy URL as the primary action, plus Open and Settings.
   - Settings is a `FormDialog`: sponsors on or off, info blocks between sponsors (1–5), and for each block enabled, seconds (5–60) and weight (1–10).
   - The toolbar has **Add display**, a `FormDialog` with the name and a floor select.
   - The actions in `displays.ts` return `ActionResult` and join `ACTION_RESULT_FILES`. Each one starts with `requireEventAccess(eventId, ["producer"])`.
6. **Root layout.** `(display)/layout.tsx` uses `lang="en"` (the overlay copy is English) and `fontVariables`, on an opaque black body with no cursor and no scroll.

## Global Constraints

**Display**
- The screen is 9:16 portrait. The stage is 1080×1920 CSS px, scaled uniformly; at 2160×3840 that is a scale of 2.
- The route is `/display/[eventId]/[displayId]`. It requires no login and returns 404 when the device is missing or belongs to another event.
- Text on the display is at least 40 stage px. Names are at least 56 and headings at least 96.

**Durations and weights**
- Info block durations are 5–60 s; weights are 1–10; info between sponsors is 1–5. These are DB checks, and the actions mirror them.
- Sponsor durations and weights come from `EventSponsor.display` (Part A). Only sponsorships with `display.enabled` rotate.

**Guards**
- Displays use `requireEventAccess(eventId, ["producer"])`. RLS is `can_manage_event_displays`.
- The kiosk only reads public rows. The app never uses a service key.

**Commits**
- `pnpm check && git commit`. Stage files by name. The title is a plain sentence. The last line is `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Copy**
- `That floor isn't part of this event.`
- The empty state is `No displays yet.`
- The standby screen shows the RepOne logo only.

## Review Focus

1. **Only one sponsor, or none, or no info block is eligible.** The player never stalls, spins or blanks. Standby shows and is retried every 5 s. *Pinned by:* the scheduler's degenerate tests (Task 1) and a player test (Task 5).
2. **The schedule changes mid-rotation** (a sponsorship deactivated, a weight edited, the heat advanced). The change applies on the next item, without restarting and without showing a removed sponsor again. *Pinned by:* the scheduler's tests and a player test that re-renders with fewer sponsors.
3. **Realtime drops.** Heat and leaderboard info stays for 5 minutes, then is suppressed; sponsors keep rotating. *Pinned by:* the eligibility staleness test.
4. **A display URL with another event's id, or a deleted device.** The route returns 404. *Pinned by:* a snapshot loader test.
5. **A producer of event A edits event B's display, or picks a floor of another event.** The action is refused; RLS and the floor trigger back it up. *Pinned by:* action tests and `db:display-check`.

---

### Task 1: Weighted scheduler (pure)

- [ ] Copy `src/lib/display/scheduler.ts` and `scheduler.test.ts` exactly from the original plan's Task B1 (Steps 1–4).
- [ ] Confirm the test fails first, then passes.
- [ ] Run `pnpm biome format --write` on both files.

### Task 2: Eligibility (pure)

- [ ] Copy `src/lib/display/eligibility.ts` and `eligibility.test.ts` exactly from the original plan's Task B2.
- [ ] Confirm the test fails first, then passes.

Commit Tasks 1–2 together: "The venue display has a weighted sponsor and info scheduler".

### Task 3: Display devices migration, seed and DB check

**Files:**
- Create: `supabase/migrations/0033_display_devices.sql`, `scripts/display-check.ts`
- Modify: `supabase/seed.sql`, `package.json` (`db:display-check`)

**Steps**
- [ ] **Write `scripts/display-check.ts`.** Use the `sponsor-check.ts` boilerplate. It checks that:
  - the seeded display `…0090` exists and has the 3 default blocks;
  - the producer (assigned to event `…010`) can update the display's name;
  - anon can read the display but can't update it;
  - the commentator can't insert a display;
  - inserting a display on a floor of another event fails with `display_floor_event`. If the seed has no second event's floor, create a venue and floor on a temporary event through the service client and clean it up afterwards.
- [ ] **See it fail.** The relation doesn't exist yet.
- [ ] **Write the migration.** Use the original plan's Task B3 SQL with the header changed to `0033`. Keep `sponsors` in the `alter publication` list, guarded by a `do $$ … if not exists (select 1 from pg_publication_tables …)` block for each table, so a table that is already published doesn't error.
- [ ] **Append the seed display** from the original Task B3 Step 3.
- [ ] **Reset and check.** Run `pnpm db:reset && pnpm db:types && pnpm dev:accounts && pnpm db:display-check`. Every line should read `ok`.

### Task 4: Snapshot loader and the stage

**Files:**
- Create: `src/lib/display/snapshot.ts` (server) and `src/lib/display/toBlockSettings.ts` (pure) with tests; `src/components/display/DisplayStage.tsx`
- Modify: `src/lib/broadcast/stage.ts` and its test; `src/lib/realtime/useRefreshOnChanges.ts` (widen the `table` union with `display_devices`, `display_blocks`, `event_sponsorships`, `sponsor_creatives`, `sponsor_packages`, `sponsors` and `broadcast_state`); `src/app/globals.css` (the `dp` tokens)

**Interfaces**

```ts
export interface DisplayDevice { id: string; eventId: string; floorId: string; name: string; enabled: boolean; sponsorsEnabled: boolean; infoBlocksBetweenSponsors: number }
export interface DisplaySnapshot { device: DisplayDevice; blocks: BlockSetting[]; sponsors: EventSponsor[]; heats: FloorHeat[]; eventName: string }
export async function loadDisplaySnapshot(eventId: string, displayId: string): Promise<DisplaySnapshot | null>;
// toBlockSettings: DB rows → BlockSetting[] in the fixed order current_heat, next_heat, leaderboard.
export function toBlockSettings(rows: Array<{ block_type: InfoBlockType; enabled: boolean; duration_seconds: number; weight: number }>): BlockSetting[];
export const DISPLAY_STAGE = { width: 1080, height: 1920 } as const;
export function fitStage(stage: { width: number; height: number }, width: number, height: number): { s: number; x: number; y: number };
```

`loadDisplaySnapshot` returns null when the device is missing or `device.event_id !== eventId`. Its sponsors keep only `display.enabled`.

**Tests**
- `fitStage` at 1080×1920 gives a scale of 1, at 2160×3840 a scale of 2, and in a 1920×1080 landscape viewport it centres horizontally.
- `toBlockSettings` returns the fixed order whatever order the DB gives.

### Task 5: Route, player and blocks

**Files:**
- Create:
  - `src/app/(display)/layout.tsx`
  - `src/app/(display)/display/[eventId]/[displayId]/page.tsx`
  - `.../DisplayPlayer.tsx` and its test
  - `src/components/display/SponsorAdBlock.tsx`, `CurrentHeatBlock.tsx`, `NextHeatBlock.tsx`, `LeaderboardBlock.tsx`, `StandbyScreen.tsx`

**Player.** It follows the original plan's Task B5 Step 4, with these differences:
- Its props are `{ snapshot, initialBroadcastState }`, and it runs `useRefreshOnChanges` on:
  - `display_devices` (`id=eq.<id>`) and `display_blocks` (`display_id=eq.<id>`);
  - `event_sponsorships` (`event_id=eq.<eventId>`);
  - `sponsors`, `sponsor_packages` and `sponsor_creatives`, unfiltered (low volume);
  - `heats` (`floor_id=eq.<floorId>`).
- The leaderboard uses `useDivisionStandings((current ?? next)?.division.id ?? null)`. It shows the top 8 rows, and `leaderboardRows = rows.length`.
- The latest inputs live in a ref, so a refresh doesn't reset the running timer.
- When no item is eligible, or `!device.enabled`, it shows `StandbyScreen` and retries every 5 s.
- Each item renders inside `<Appear show variant="fade" key={counter}>`.

**Tests** (jsdom, fake timers, with `useBroadcastState`, `useDivisionStandings` and `useRefreshOnChanges` mocked):
1. It starts with a sponsor, and after the sponsor's duration an info block shows.
2. With no sponsors and no eligible info, it shows standby.
3. When re-rendered with a sponsor removed, the removed sponsor never shows again.
4. A disabled device shows standby.

**Blocks.** Load the `impeccable` skill first.
- **Sponsor:** the first creative full-bleed with `object-cover`. Without a creative, the logo (or the name in `dp-hero`) on `broadcast-fg` with the package name.
- **Current heat:** "NOW ON THE FLOOR", the WOD, "HEAT n OF m", the division, and the lanes (lane, athlete, affiliate), in 2 columns past 6 lanes.
- **Next heat:** "UP NEXT" with the same body.
- **Leaderboard:** "LEADERBOARD", the division, and the top 8 (place, name, points).
- **Standby:** the RepOne logo centred on black.

### Task 6: Producer display management

**Files:**
- Create: `src/lib/actions/displays.ts` and its test, `src/app/(app)/producer/events/[eventId]/displays/page.tsx`, `DisplaysTable.tsx`, `DisplayForms.tsx`
- Modify: the producer event `layout.tsx` (the Displays tab after Sponsors) and `uiGuard.ts`

**Actions**, each returning `ActionResult`:
- `createDisplay(eventId, fd)` takes `name` and `floor_id`. A `display_floor_event` error becomes `fail("That floor isn't part of this event.", { floor_id: [...] })`.
- `toggleDisplayEnabled(eventId, displayId, enabled)`.
- `updateDisplaySettings(eventId, displayId, fd)` takes `sponsors_enabled`, `info_blocks_between_sponsors`, and for each block `<type>_enabled`, `<type>_duration` and `<type>_weight`. It updates the device, then upserts the 3 blocks with `onConflict: "display_id,block_type"`.
- Writes filter with `.eq("event_id", eventId)` and revalidate the Displays page.

**Tests:**
- a floor of another event is refused;
- a duration of 4 gives a field error;
- settings send the 3 block rows;
- a toggle with no changed row reports not found (`expectChanged`).

**Page.** It lists the event's displays with their floor names and the event's floors for the select. The Copy URL action writes `${location.origin}/display/${eventId}/${id}`.

### Task 7: Browser verification, review and PR

1. **On `/display/…0010/…0090`, at 1080×1920 and 2160×3840:**
   - sponsors and info blocks alternate;
   - when the producer sets the current heat, "Now on the floor" changes on its next turn;
   - entering a result makes the leaderboard update;
   - deactivating a sponsorship (as admin) stops it appearing;
   - switching the display off shows standby, and switching it on resumes the rotation.
   - Screenshots go in `.verify/display/`.
2. **The producer Displays tab:** create a display, try a floor of another event if one exists, change the settings, copy the URL. Also check it at 390 wide.
3. **Clean up:** reset `broadcast_state`, remove the test displays, re-run `seed-qa`, and close the pages.
4. **Final review** on the most capable model. Fix Critical and Important findings test-first.
5. **Open the PR** against staging. It notes that it stacks on #29, and lists client decisions 1–2. Stop at the link.
