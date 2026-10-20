# Commentator desk — Design

**Date:** 2026-10-04

**Status:** The design was approved in conversation. The owner's one answer: the Notes placeholder route stays until its feature is defined. This written spec is awaiting review.

**Branch:** `feat/commentator-desk`, from `staging`. The PR targets `staging`.

**Sub-project 5 of 7** from the UI/UX audit (`.impeccable-audit/AUDIT.md`). It builds on:
- sub-project 2: `DataTable` and `dataTableColumns`;
- sub-project 3: the scorekeeper's sticky header and `activeHeatId` hold pattern;
- sub-project 4: shadcn `Table`, and `EventHeatsList` already as tables.

## Goal

A commentator on a laptop sees every athlete in the current heat on one screen, along with what the athletes are doing (the WOD), without switching tabs. On a phone the same view reads cleanly in one column. The commentator's reference tabs read like the rest of the app: tables and an accordion, not stacks of cards.

**Success means:**
- At 1440×900, a 6-lane heat's athletes are all visible without scrolling: 3 columns × 2 rows.
- At 390 wide there is no horizontal scroll, and every target is at least 44px.
- The current heat's WOD description is reachable from the dashboard without leaving it.
- Lanes and Athletes are tables, and WODs is an accordion.

## Non-goals

- The Leaderboard tab. It renders `LiveEventClient`, the public Live view, which is redesigned in sub-project 6. That redesign changes this tab too.
- The Notes route (`commentator/events/[eventId]/notes`). It stays as it is: not in the tabs, until the owner defines it.
- Live scores per lane on the dashboard. That's a new feature, not a redesign.
- Data loading (`getCommentatorAthleteDetails`, `getEventLiveContext`) and permissions.

## 1. The dashboard

`CommentatorClient` renders both the event's Dashboard tab (through `EventCommentatorDashboard`) and `/commentator/[floorId]`.

### Sticky heat header

It sits at `top-[calc(3.5rem+env(safe-area-inset-top))]`, under the shell header. It is sticky only on screens at least 600px tall: `[@media(min-height:600px)]:sticky`, as on the scorekeeper.

- **Line 1:** `WOD 2 · Heat 6 / 9` in display type (`text-2xl`, `sm:text-3xl`), followed by the connection dot with "Live" or "Reconnecting…".
- **Line 2:** the division.
- **Line 3:**
  - an icon button with `aria-label="Previous heat"`;
  - the heat Select, which fills the row and is labelled "Heat" (sr-only);
  - an icon button with `aria-label="Next heat"`;
  - then either "Following live heat" or a **Follow live heat** button.

  All of these are at least 44px.

### Current WOD

A disclosure (`<details>`) sits under the header and is closed by default. Its summary reads `WOD 2 · For time · 15 min cap`, with a minimum height of 44px. Opening it shows the description with `whitespace-pre-wrap`, or "No description on file." when there is none.

The scoring-type label comes from a shared map:
- `for_time` → For time
- `amrap` → AMRAP
- `max_load` → Max load
- `points` → Points
- `other` → Other

### Lane grid

The grid is `grid gap-3 sm:grid-cols-2 lg:grid-cols-3`: one column on a phone. There is one card per lane that has an athlete, in lane order.

Each card is a compact `Card size="sm"`:
- **Heading row:**
  - the lane number in a primary square;
  - the athlete's name, `text-xl font-bold`, wrapping at word boundaries and never mid-word;
  - the affiliate, muted, on its own line;
  - the age-category badge, if any.
- **Lifts & benchmarks:** at most 4 chips, lifts first, then benchmarks. When there are more, a muted `+N more` chip follows. The chips wrap.
- **Previous standings:**
  - The first history entry shows as `Event name (Division) · #2 overall`, plus its WOD placements in small chips.
  - Any further entries sit behind a `<details>` whose summary is `+N more events` (44px).
- **No data:** a card with no lifts, benchmarks or history says "No lifts, benchmarks or history on file yet."

Truncation is pure presentation over `CommentatorAthleteDetails`. The data stays as it is.

### Floor switching

`EventCommentatorDashboard` keys `CommentatorClient` by `floorId`. This is the same fix the producer board got: the follow and manual-heat state must not carry over to another floor.

### Unchanged

- Follow-live and manual-heat behaviour.
- The standalone page's "Choose a different floor" link.

## 2. The tabs

### Lanes

One `section` per floor, with an `h2` reading `Venue — Floor`. Under it:
- the heat line (`WOD 2 · Heat 6 — Intermediate Female`, plus a "Live" marker when that heat is on air);
- a shadcn `Table` with the columns **Lane** (number, tabular figures), **Athlete** and **Affiliate** (or `—`).

The empty states stay as they are.

### Athletes

A `CommentatorAthletesTable` client component built with module-scope columns and `DataTable`. The columns are:

| Column | Notes |
|---|---|
| Athlete | The athlete's or team's name; searchable |
| Bib | `#12` or `—`; low priority |
| Division | Filterable |
| Affiliate | Low priority |

- **Search:** labelled "Search athletes", with the placeholder "Search by name, bib or affiliate…".
- **Division filter:** built from the divisions present in the rows.
- **Initial sort:** by name. It is a text accessor on "last first", so sorting matches today's order.
- **Empty state:** unchanged.
- **Data:** the page builds the rows from the existing query.

### WODs

A shadcn `Accordion` (`type="multiple"`), added with the shadcn CLI. As with `toggle`, the `cn` import must be checked: the CLI once pulled a stray `cn` package.

Each item is one WOD:
- the trigger reads the WOD name, followed by the scoring badge (`For time · 15 min cap`);
- the content is the description, or "No description on file."

Items start closed. The trigger is at least 44px. The empty state is unchanged.

### Unchanged

- The Heats tab, done in #24.
- The Leaderboard tab (sub-project 6).
- The Notes route.

## 3. Shared helper

`src/lib/scoring/format.ts` gains two functions:
- `scoringLabel(scoringType: string): string`, using the map in §1. An unknown value returns the raw value with underscores turned into spaces.
- `wodSummary(wod: { name: string; scoring_type: string; time_cap_seconds: number | null }): string`. For example, `"WOD 2 · For time · 15 min cap"`; the cap part is left out when the WOD has none. Minutes are `Math.round(seconds / 60)`.

The dashboard disclosure and the WODs accordion both use it. The producer's admin heat subtitle can adopt it later.

## 4. Testing

- **Unit:**
  - `scoringLabel` covers every known type plus an unknown one.
  - `wodSummary` covers a WOD with a cap and one without.
- **Components (jsdom):**
  - `CommentatorClient`:
    - renders a card per laned athlete;
    - shows at most 4 stat chips plus `+N more`;
    - hides history beyond the first entry behind `+N more events`;
    - shows the WOD summary;
    - with the live heat set, says "Following live heat";
    - Next heat steps off follow;
    - Follow live heat comes back.

    Mock `useBroadcastState` as the production board tests do.
  - `EventCommentatorDashboard`: switching floors shows the new floor's state. This is the keyed-remount test, as for the producer.
  - `CommentatorAthletesTable`: search by name, and the bib cell.
- **Guard:** `pnpm ui:guard` passes.
- **Browser** (screenshots in `.verify/commentator/`), signed in as the commentator dev account:
  - at 1440×900, all 6 lanes are visible without scrolling (`dash-1440.png`);
  - at 820×1180 (`dash-820.png`);
  - at 390×844, with no horizontal scroll and no target under 44px (`dash-390.png`);
  - open the WOD disclosure;
  - expand `+N more events` on an athlete that has history, if the seed has one;
  - the Lanes, Athletes (search plus division filter) and WODs (open one) tabs;
  - Lighthouse accessibility of at least 95 on the Dashboard tab, desktop and mobile;
  - close the browser pages.

## 5. Docs

`DESIGN.md` gets no new section. The "Live control boards" note covers boards that drive what's on air. This is a reading view, and the admin guide's tables-not-cards rule already covers its tabs.
