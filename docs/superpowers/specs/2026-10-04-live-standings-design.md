# Live standings — Design

**Date:** 2026-10-04

**Status:** The design was approved in conversation. It is the first of two PRs for sub-project 6; Athlete + Messages is the second. This written spec is awaiting review.

**Branch:** `feat/live-standings`, from `staging`. The PR targets `staging`.

**Sub-project 6a of 7** from the UI/UX audit (`.impeccable-audit/AUDIT.md`, `public-auth-athlete/report.md` #11). It builds on the design system and on `src/lib/scoring/divisionOrder.ts` for WOD running order.

## Goal

A spectator on a phone opens an event's live page and sees two things:
- what's on the floor right now;
- in one tap, the standings for their division, with each WOD's placing next to the total.

They don't scroll past every other division to get there. The commentator's Leaderboard tab gets the same view.

**Success means:**
- The live page has two tabs, **Now** and **Standings**.
- Standings shows one division at a time, picked from a Select.
- The chosen tab and division survive a reload and a shared link, through `?tab=` and `?division=`.
- Each standings row shows place, athlete, a placing for every WOD that has standings, and the overall points.
- At 390 wide, the place and athlete columns stay pinned while the WOD columns scroll sideways. The page itself never scrolls sideways.
- Standings still update live when a result is saved, with no reload.
- The commentator's Leaderboard tab opens on Standings.

## Non-goals

- The overlays' leaderboard and program graphics. They keep `useStandings` as is (sub-project 7).
- The `/live` index (already a card grid), the circuit page, and the 404 (already dark).
- Scoring and standings computation, and RLS. Standings are already publicly readable.
- The PublicShell header.

## 1. Data: `useDivisionStandings`

A new client hook lives at `src/lib/realtime/useDivisionStandings.ts`.

```ts
export interface StandingsWod { id: string; name: string }
export interface DivisionStandingRow {
  key: string;                      // athlete or team id
  placement: number | null;         // overall
  points: number | null;            // overall
  name: string;
  wodPlacements: Record<string, number | null>; // by wod id
}
export function useDivisionStandings(divisionId: string | null): {
  wods: StandingsWod[]; rows: DivisionStandingRow[]; loading: boolean;
};
```

**Fetching.**
- One query reads every standings row for the division (overall and per WOD): `select("wod_id, placement, points, athlete_id, team_id, athletes(first_name, last_name), teams(name), wods(id, name, created_at)")`, filtered with `.eq("division_id", divisionId)`.
- A pure function, `pivotStandings(raw)`, turns those rows into `{ wods, rows }`. It lives in `src/lib/scoring/pivotStandings.ts`.

**What the pivot does.**
- **Rows:** the overall rows (`wod_id` null), ordered by placement with nulls last, then by name.
- **Competitor key:** `athlete_id ?? team_id`.
- **Per-WOD placings:** each WOD placing is attached to its competitor's row. A competitor with only per-WOD rows and no overall row is left out, because the overall row is the leaderboard.
- **WOD columns:** the distinct WODs that have standings, in running order (`created_at` ascending, the same rule as `divisionOrder.ts`).

**Live updates.** Same as `useStandings`: one channel per division on `standings` with `division_id=eq.<id>`, refetching on change. `loading` is true until the first fetch for the current division resolves.

## 2. The live event view: `LiveEventClient`

New props: `defaultTab?: "now" | "standings"`, defaulting to `"now"`.

### Tabs and URL state

- The page uses shadcn `Tabs` with **Now** and **Standings**.
- On load:
  - The tab comes from `?tab=` (`now` or `standings`), falling back to `defaultTab`.
  - The division comes from `?division=<id>`, falling back to the first division.
- Changing either one updates the URL with `window.history.replaceState`. This keeps the current path and the other parameters, and causes no navigation and no scroll.
- An unknown tab or division value falls back to the default.

### Now tab

The page renders today's per-floor cards (`FloorNowCompeting`) unchanged, under a sr-only `h2` reading "Now competing". The empty state stays the same.

### Standings tab

- **Division picker:** a labelled shadcn `Select` ("Division"), full width on a phone and `w-72` from `sm`. It is hidden when there is only one division.
- **Loading:** while `loading` is true, three `Skeleton` rows show in place of the table.
- **Table columns:**
  - **#**: overall placement, or `—`;
  - **Athlete**;
  - one column per WOD, headed with the WOD name and holding its placing as `1st`, `2nd`, `3rd` or `4th`, or `—`;
  - **Pts**: overall points, or `—`.
- **Pinned columns:**
  - The table sits in an `overflow-x-auto` wrapper.
  - The # and Athlete header and body cells are `sticky left-0` and `sticky left-12` (the # column is `w-12`), with a `bg-card` background so scrolled cells don't show through.
  - The Athlete column has a minimum width of `10rem` and wraps names at word boundaries.
- **Rows:** at least 44px tall.
- **Points and placings:** tabular figures.
- **Empty state:** if the division has no overall rows, the existing copy "No scored results yet. Standings fill in as heats are finished."
- **No divisions:** if the event has no divisions, the existing empty state.

Ordinals come from a small pure helper, `ordinal(n: number): string`, in `src/lib/scoring/format.ts`. It handles 1st, 2nd, 3rd, 4th, 11th to 13th, 21st, 22nd, 23rd and 101st.

### Connection state

Each floor card already shows a dot with the words "Live" or "Reconnecting…", so it stays. Standings have no separate connection indicator.

## 3. Pages

- **`live/[eventId]/page.tsx`:** unchanged apart from rendering `LiveEventClient` with the default tab.
- **`commentator/events/[eventId]/leaderboard/page.tsx`:** passes `defaultTab="standings"`.

## 4. Testing

**Unit tests**
- `pivotStandings`:
  - ordering by placement, with nulls last;
  - WOD column order by `created_at`;
  - a competitor's per-WOD placings attached by athlete or team id;
  - per-WOD-only competitors dropped;
  - empty input.
- `ordinal`: every case listed in §2.

**Component tests (jsdom)**

`LiveEventClient`, with `useDivisionStandings`, `useFloorOverlay` and `useLiveTimer` mocked:
- `?tab=standings&division=d2` opens on Standings with d2 selected;
- switching the tab calls `history.replaceState` with `tab=standings`;
- the table shows a WOD placing as `2nd` and the points;
- `defaultTab="standings"` opens on Standings;
- skeleton rows show while loading.

**Browser** (screenshots in `.verify/live/`), on `/live/<eventId>` signed out:
- at 390×844: the Now tab, then the Standings tab;
- scroll the table sideways and check that the pinned columns stay (`standings-390.png`), with no page-level horizontal scroll;
- at 1440 (`standings-1440.png`);
- reload with the query string and check the same tab and division come back;
- save a result as scorekeeper and check that the table updates without a reload;
- the commentator's Leaderboard opens on Standings;
- Lighthouse accessibility of at least 95 on the live page, on mobile.

Standings need results. Create two through the scorekeeper drawer, and delete them and their standings afterwards. Close the browser pages.
