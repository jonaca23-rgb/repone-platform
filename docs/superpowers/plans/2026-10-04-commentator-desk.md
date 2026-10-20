# Commentator Desk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The commentator's dashboard becomes a sticky heat header with the current WOD and a 3-column grid of compact athlete cards. Lanes, Athletes and WODs become a table, a DataTable and an accordion.

**Architecture:**
- `wodSummary` and `scoringLabel` are pure helpers in `lib/scoring/format.ts`.
- `CommentatorClient` is rewritten in place. The athlete card is a separate `AthleteCard` in the same folder.
- `EventCommentatorDashboard` keys the client by floor.
- Tabs:
  - Lanes uses shadcn `Table`.
  - Athletes is a module-scope-column `DataTable`.
  - WODs uses shadcn `Accordion`.

**Tech Stack:** Next.js 16, React 19, shadcn radix-vega (adds `accordion`), TanStack Table v9 via `DataTable`, Vitest 4 with Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-04-commentator-desk-design.md`

## Global Constraints

- **Branch and PR.** Work on `feat/commentator-desk`. The PR goes against `staging`.
- **Commits.**
  - Commit only after `pnpm check` passes. Run them chained: `pnpm check && git commit …`. Never commit when the check failed.
  - Stage files by name.
  - Each commit is a plain-sentence title, a body saying why, then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Targets.** Every interactive target is at least 44px. Names never break mid-word: no `break-all`, no `overflow-wrap:anywhere` on names.
- **Copy.** UI copy is English. Exact strings:
  - `No lifts, benchmarks or history on file yet.`
  - `+${n} more`
  - `+${n} more events`
  - `No description on file.`
  - `Search athletes` / `Search by name, bib or affiliate…`
- **jsdom tests.**
  - Start with `// @vitest-environment jsdom`.
  - Stub `ResizeObserver` (Radix Select, Switch and Accordion) and `matchMedia` (DataTable).
- **Out of scope.** The Notes route and the Leaderboard tab.

## Review Focus

1. **An athlete with no details entry** (not in `detailsByAthleteId`). The card shows the no-data line and doesn't crash. Pinned in Task 2.
2. **Exactly 4 stats.** No `+N more` chip. With 5 stats, `+1 more`. Pinned in Task 2.
3. **A WOD with no time cap and no description.** The summary has no cap part, and the body says "No description on file." Pinned in Tasks 1 and 2.
4. **Switching floors on the event dashboard.** The follow state resets. Pinned in Task 2.
5. **A long athlete name at 390.** It wraps between words, with no horizontal scroll. Checked in Task 4 (browser).

---

### Task 1: `scoringLabel` and `wodSummary`

**Files:**
- Modify: `src/lib/scoring/format.ts` (append)
- Test: `src/lib/scoring/format.test.ts` (append)

**Interfaces:**
- Produces:
  - `scoringLabel(scoringType: string): string`
  - `wodSummary(wod: { name: string; scoring_type: string; time_cap_seconds: number | null }): string`

- [ ] **Step 1: Write the failing test.** Append to `format.test.ts`, adding `scoringLabel, wodSummary` to its import from `./format`:

```ts
describe("scoringLabel", () => {
  it.each([
    ["for_time", "For time"],
    ["amrap", "AMRAP"],
    ["max_load", "Max load"],
    ["points", "Points"],
    ["other", "Other"],
    ["tie_break_only", "tie break only"],
  ])("%s reads %s", (type, label) => expect(scoringLabel(type)).toBe(label));
});

describe("wodSummary", () => {
  it("names the cap in minutes", () =>
    expect(wodSummary({ name: "WOD 2", scoring_type: "for_time", time_cap_seconds: 900 })).toBe(
      "WOD 2 · For time · 15 min cap",
    ));
  it("leaves out a missing cap", () =>
    expect(wodSummary({ name: "WOD 1", scoring_type: "max_load", time_cap_seconds: null })).toBe(
      "WOD 1 · Max load",
    ));
});
```

- [ ] **Step 2: Run it and see it fail.** Run `pnpm vitest run src/lib/scoring/format.test.ts`. Expected: FAIL, because the import doesn't exist.

- [ ] **Step 3: Implement it.** Append to `format.ts`:

```ts
const SCORING_LABEL: Record<string, string> = {
  for_time: "For time",
  amrap: "AMRAP",
  max_load: "Max load",
  points: "Points",
  other: "Other",
};

/** "For time", "AMRAP"…; an unknown type reads as its words. */
export function scoringLabel(scoringType: string): string {
  return SCORING_LABEL[scoringType] ?? scoringType.replace(/_/g, " ");
}

/** "WOD 2 · For time · 15 min cap" — a WOD in one line. */
export function wodSummary(wod: {
  name: string;
  scoring_type: string;
  time_cap_seconds: number | null;
}): string {
  const cap = wod.time_cap_seconds ? ` · ${Math.round(wod.time_cap_seconds / 60)} min cap` : "";
  return `${wod.name} · ${scoringLabel(wod.scoring_type)}${cap}`;
}
```

- [ ] **Step 4: Run it and see it pass.** Run the same command. Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/scoring/format.ts src/lib/scoring/format.test.ts
pnpm check && git commit -m "A WOD can be summed up in one line

The commentator's dashboard and WODs tab both say a WOD as name,
scoring type and cap; one helper writes it.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The dashboard

**Files:**
- Create: `src/app/(app)/commentator/[floorId]/AthleteCard.tsx`
- Rewrite: `src/app/(app)/commentator/[floorId]/CommentatorClient.tsx`
- Modify: `src/app/(app)/commentator/events/[eventId]/dashboard/EventCommentatorDashboard.tsx` (add `key`)
- Test: `src/app/(app)/commentator/[floorId]/CommentatorClient.test.tsx`
- Test: `src/app/(app)/commentator/events/[eventId]/dashboard/EventCommentatorDashboard.test.tsx`

**Interfaces:**
- Consumes: Task 1's `wodSummary`, plus `FloorHeat` and `CommentatorAthleteDetails`.
- Produces:
  - `AthleteCard({ lane, details })`, where `lane` is a `FloorHeat` lane and `details` is `CommentatorAthleteDetails | undefined`.
  - `CommentatorClient`, with the same props as today.

- [ ] **Step 1: Write the failing tests.**

`CommentatorClient.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
vi.mock("@/lib/realtime/useBroadcastState", () => ({
  useBroadcastState: (_f: string, initial: unknown) => ({ state: initial, connected: true }),
}));

import type { CommentatorAthleteDetails } from "@/lib/db/commentator";
import type { FloorHeat } from "@/lib/db/queries";
import { CommentatorClient } from "./CommentatorClient";

const heat = (n: number, athletes: string[]): FloorHeat =>
  ({
    id: `h-${n}`,
    heatNumber: n,
    heatCount: 2,
    endedAt: null,
    wod: {
      id: "w",
      name: "WOD 2",
      description: n === 1 ? "21-15-9 thrusters and pull-ups" : null,
      scoring_type: "for_time",
      time_cap_seconds: n === 1 ? 900 : null,
      created_at: "",
    },
    division: { id: "d", name: "Intermediate Female" },
    lanes: athletes.map((a, i) => ({
      laneNumber: i + 1,
      athleteId: a,
      name: `Athlete ${a}`,
      affiliate: i === 0 ? "CrossFit Aprieta" : null,
    })),
  }) as FloorHeat;

const chip = (i: number) => ({ id: `l${i}`, label: `Lift ${i}`, valueDisplay: `${i}0 lb` });
const DETAILS: Record<string, CommentatorAthleteDetails> = {
  a: {
    ageCategoryLabel: "Masters",
    lifts: [chip(1), chip(2), chip(3)] as never,
    benchmarks: [
      { id: "b1", name: "Fran", resultDisplay: "3:45" },
      { id: "b2", name: "Grace", resultDisplay: "2:10" },
    ] as never,
    history: [
      { eventId: "e1", eventName: "Aprieta 2025", divisionName: "Int F", overall: { placement: 2 }, wods: [] },
      { eventId: "e2", eventName: "Open 2025", divisionName: "Int F", overall: null, wods: [] },
      { eventId: "e3", eventName: "Summer 2024", divisionName: "Int F", overall: null, wods: [] },
    ] as never,
  },
  b: { ageCategoryLabel: null, lifts: [chip(1)] as never, benchmarks: [] as never, history: [] as never },
};

const HEATS = [heat(1, ["a", "b", "c"]), heat(2, ["d"])];
const live = { current_heat_id: "h-1" } as never;

afterEach(cleanup);

describe("CommentatorClient", () => {
  it("shows a compact card per laned athlete", () => {
    render(<CommentatorClient floorId="f" heats={HEATS} initialBroadcastState={live} detailsByAthleteId={DETAILS} />);
    expect(screen.getByText("Athlete a")).toBeTruthy();
    expect(screen.getByText("Athlete b")).toBeTruthy();
    expect(screen.getByText("Athlete c")).toBeTruthy();
    // 5 stats for a: 4 chips + "+1 more"
    expect(screen.getByText("+1 more")).toBeTruthy();
    expect(screen.queryByText(/Grace/)).toBeNull();
    // b has exactly 1 stat: no "+N more"
    expect(screen.getAllByText(/\+\d+ more$/).length).toBe(1);
    // history beyond the first is folded
    expect(screen.getByText("Aprieta 2025")).toBeTruthy();
    expect(screen.getByText("+2 more events")).toBeTruthy();
    // c has no details at all
    expect(screen.getByText("No lifts, benchmarks or history on file yet.")).toBeTruthy();
  });

  it("shows the current WOD and follows the live heat", async () => {
    render(<CommentatorClient floorId="f" heats={HEATS} initialBroadcastState={live} detailsByAthleteId={DETAILS} />);
    expect(screen.getByText("WOD 2 · For time · 15 min cap")).toBeTruthy();
    expect(screen.getByText("Following live heat")).toBeTruthy();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Next heat" }));
    expect(screen.getByText("Athlete d")).toBeTruthy();
    expect(screen.getByText("WOD 2 · For time")).toBeTruthy();
    expect(screen.getByText("No description on file.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Follow live heat/ }));
    expect(screen.getByText("Athlete a")).toBeTruthy();
  });
});
```

`EventCommentatorDashboard.test.tsx`:

```tsx
// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// Like the real client, the stand-in keeps per-floor state in useState.
vi.mock("@/app/(app)/commentator/[floorId]/CommentatorClient", () => ({
  CommentatorClient: ({ initialBroadcastState }: { initialBroadcastState: { label: string } }) => {
    const [shown] = useState(initialBroadcastState.label);
    return <p>Showing {shown}</p>;
  },
}));

import { EventCommentatorDashboard } from "./EventCommentatorDashboard";

const floor = (id: string, label: string) =>
  ({ floorId: id, floorName: id, venueName: "Main", heats: [], initialBroadcastState: { label } }) as never;

afterEach(cleanup);

describe("EventCommentatorDashboard", () => {
  it("shows the picked floor's own state", async () => {
    render(
      <EventCommentatorDashboard
        floors={[floor("A", "floor A"), floor("B", "floor B")]}
        detailsByAthleteId={{}}
      />,
    );
    expect(screen.getByText("Showing floor A")).toBeTruthy();
    await userEvent.setup().click(screen.getByRole("button", { name: "Main — B" }));
    expect(screen.getByText("Showing floor B")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run them and see them fail.** Run `pnpm vitest run "src/app/(app)/commentator"`. Expected:
  - The client test fails: there is no `+1 more`, no WOD summary, and no "Next heat" aria-label.
  - The floor test fails: it shows floor A after the switch.

- [ ] **Step 3: Implement `AthleteCard.tsx`.**

```tsx
import type { CommentatorAthleteDetails } from "@/lib/db/commentator";
import type { FloorHeat } from "@/lib/db/queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const MAX_STATS = 4;
const CHIP = "rounded-full bg-muted px-2.5 py-0.5 text-sm";
const SECTION = "text-xs font-bold tracking-widest text-muted-foreground uppercase";

type Lane = FloorHeat["lanes"][number];

/**
 * One athlete in the current heat, compact enough that a laptop shows a whole
 * heat at once: lane and name, affiliate and age category, up to four lifts or
 * benchmarks, and the most recent event, with the rest one tap away.
 */
export function AthleteCard({
  lane,
  details,
}: {
  lane: Lane;
  details: CommentatorAthleteDetails | undefined;
}) {
  const stats = [
    ...(details?.lifts ?? []).map((l) => ({ id: l.id, label: l.label, value: l.valueDisplay })),
    ...(details?.benchmarks ?? []).map((b) => ({ id: b.id, label: b.name, value: b.resultDisplay })),
  ];
  const [latest, ...older] = details?.history ?? [];
  const empty = stats.length === 0 && !latest;

  return (
    <Card size="sm" className="h-full">
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded bg-primary font-display text-lg font-bold text-primary-foreground">
            {lane.laneNumber}
          </span>
          <div className="min-w-0">
            <h2 className="text-xl leading-tight font-bold">{lane.name}</h2>
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {lane.affiliate ? <span>{lane.affiliate}</span> : null}
              {details?.ageCategoryLabel ? (
                <Badge variant="outline" className="tracking-wide text-brand-text uppercase">
                  {details.ageCategoryLabel}
                </Badge>
              ) : null}
            </p>
          </div>
        </div>

        {empty ? (
          <p className="text-sm text-muted-foreground">
            No lifts, benchmarks or history on file yet.
          </p>
        ) : null}

        {stats.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <h3 className={SECTION}>Lifts &amp; benchmarks</h3>
            <div className="flex flex-wrap gap-1.5">
              {stats.slice(0, MAX_STATS).map((s) => (
                <span key={s.id} className={CHIP}>
                  {s.label}: <span className="font-semibold">{s.value}</span>
                </span>
              ))}
              {stats.length > MAX_STATS ? (
                <span className={`${CHIP} text-muted-foreground`}>
                  +{stats.length - MAX_STATS} more
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {latest ? (
          <div className="flex flex-col gap-1.5">
            <h3 className={SECTION}>Previous standings</h3>
            <HistoryLine h={latest} />
            {older.length > 0 ? (
              <details className="group">
                <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-brand-text">
                  +{older.length} more events
                </summary>
                <div className="flex flex-col gap-1.5 pt-1">
                  {older.map((h) => (
                    <HistoryLine key={h.eventId} h={h} />
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function HistoryLine({ h }: { h: CommentatorAthleteDetails["history"][number] }) {
  return (
    <div className="text-sm">
      <span className="font-semibold">{h.eventName}</span>
      <span className="text-muted-foreground"> ({h.divisionName})</span>
      {h.overall?.placement ? (
        <span className="ml-2 font-semibold text-brand-text">#{h.overall.placement} overall</span>
      ) : null}
      {h.wods.length > 0 ? (
        <div className="mt-0.5 flex flex-wrap gap-1">
          {h.wods.map((w) => (
            <span key={w.wodId} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {w.name}: {w.placement ? `#${w.placement}` : "—"}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Rewrite `CommentatorClient.tsx`.** Keep the props and the `hideBackLink` doc comment exactly as they are. Replace the imports and everything from `if (!heat)` to the end of the file:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ListOrdered, Radio, Users } from "lucide-react";
import { useBroadcastState } from "@/lib/realtime/useBroadcastState";
import type { FloorHeat } from "@/lib/db/queries";
import type { Database } from "@/lib/db/database.types";
import type { CommentatorAthleteDetails } from "@/lib/db/commentator";
import { wodSummary } from "@/lib/scoring/format";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AthleteCard } from "./AthleteCard";
```

Keep the existing state (`following`, `manualHeatId`), `activeHeatId`, `heat`, `heatIndex`, `goToHeat`, `backLink` and the `!heat` empty state as they are. Then replace the returned JSX with:

```tsx
  const lanes = heat.lanes.filter((l) => l.athleteId).sort((a, b) => a.laneNumber - b.laneNumber);

  return (
    <div className="flex flex-col">
      {/* Heat header: sticky unless the screen is short (a phone in landscape). */}
      <header className="top-[calc(3.5rem+env(safe-area-inset-top))] z-10 border-b border-border bg-background/95 backdrop-blur [@media(min-height:600px)]:sticky">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3">
          {backLink}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold tracking-wide uppercase sm:text-3xl">
                {heat.wod.name} · Heat {heat.heatNumber}
                {heat.heatCount ? ` / ${heat.heatCount}` : ""}
              </h1>
              <p className="text-sm font-semibold tracking-wide text-brand-text uppercase sm:text-base">
                {heat.division.name}
              </p>
            </div>
            <span aria-live="polite" className="flex shrink-0 items-center gap-2 text-sm font-medium">
              <span
                aria-hidden
                className={cn("size-3 rounded-full", connected ? "bg-success" : "animate-pulse bg-primary")}
              />
              {connected ? "Live" : "Reconnecting…"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              aria-label="Previous heat"
              disabled={heatIndex <= 0}
              onClick={() => heatIndex > 0 && goToHeat(heats[heatIndex - 1].id)}
            >
              <ChevronLeft aria-hidden />
            </Button>
            <Label htmlFor="commentator-heat" className="sr-only">
              Heat
            </Label>
            <Select value={heat.id} onValueChange={goToHeat}>
              <SelectTrigger id="commentator-heat" className="min-w-0 flex-1 basis-48 data-[size=default]:h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {heats.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.wod.name} — Heat {h.heatNumber} ({h.division.name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              aria-label="Next heat"
              disabled={heatIndex === -1 || heatIndex >= heats.length - 1}
              onClick={() =>
                heatIndex >= 0 && heatIndex < heats.length - 1 && goToHeat(heats[heatIndex + 1].id)
              }
            >
              <ChevronRight aria-hidden />
            </Button>
            {following ? (
              <span className="flex min-h-11 items-center gap-2 text-xs font-semibold tracking-wide text-brand-text uppercase">
                <Radio className="size-4" aria-hidden />
                Following live heat
              </span>
            ) : (
              <Button
                type="button"
                variant="secondary"
                className="min-h-11 gap-2"
                onClick={() => {
                  setFollowing(true);
                  setManualHeatId(null);
                }}
              >
                <Radio aria-hidden />
                Follow live heat
              </Button>
            )}
          </div>
          <details className="rounded-lg border border-border">
            <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-semibold">
              {wodSummary(heat.wod)}
            </summary>
            <p className="px-3 pb-3 text-sm whitespace-pre-wrap">
              {heat.wod.description || (
                <span className="text-muted-foreground">No description on file.</span>
              )}
            </p>
          </details>
        </div>
      </header>

      <section aria-label="Athletes in this heat" className="mx-auto w-full max-w-7xl px-4 py-4">
        {lanes.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lanes.map((lane) => (
              <li key={lane.laneNumber}>
                <AthleteCard lane={lane} details={detailsByAthleteId[lane.athleteId!]} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Users} title="No athletes assigned to lanes for this heat yet" />
        )}
      </section>
    </div>
  );
}
```

The test expects "Following live heat" as exact text in a `span` and "Follow live heat" as a button. Both are covered.

The details `<p>` holds a `span` when there is no description. `getByText("No description on file.")` finds the `span`.

- [ ] **Step 5: Key the event dashboard by floor.** In `EventCommentatorDashboard.tsx`, add `key={selectedFloor.floorId}` to `<CommentatorClient`, with a one-line comment: `{/* Keyed by floor: the follow and picked-heat state belong to one floor. */}`.

- [ ] **Step 6: Run the tests and see them pass.** Run `pnpm vitest run "src/app/(app)/commentator"`. Expected: PASS, 3 tests.

- [ ] **Step 7: Commit.**

```bash
git add "src/app/(app)/commentator/[floorId]/AthleteCard.tsx" "src/app/(app)/commentator/[floorId]/CommentatorClient.tsx" "src/app/(app)/commentator/[floorId]/CommentatorClient.test.tsx" "src/app/(app)/commentator/events/[eventId]/dashboard/EventCommentatorDashboard.tsx" "src/app/(app)/commentator/events/[eventId]/dashboard/EventCommentatorDashboard.test.tsx"
pnpm check && git commit -m "The commentator sees a whole heat at once, with its WOD

A sticky heat header with the current WOD one tap open, and compact
athlete cards three to a row on a laptop: four stats and the latest
event up front, the rest folded. Switching floors no longer carries
the previous floor's follow state.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Lanes, Athletes and WODs tabs

**Files:**
- Modify: `src/app/(app)/commentator/events/[eventId]/lanes/page.tsx`
- Create: `src/app/(app)/commentator/events/[eventId]/athletes/CommentatorAthletesTable.tsx`
- Test: `src/app/(app)/commentator/events/[eventId]/athletes/CommentatorAthletesTable.test.tsx`
- Modify: `src/app/(app)/commentator/events/[eventId]/athletes/page.tsx`
- Create (generated): `src/components/ui/accordion.tsx`
- Modify: `src/app/(app)/commentator/events/[eventId]/wods/page.tsx`

**Interfaces:**
- Produces:
  ```ts
  export type CommentatorAthleteRow = {
    id: string;
    name: string;
    sortName: string;
    bib: string | null;
    division: string;
    affiliate: string | null;
  };
  export function CommentatorAthletesTable(props: {
    rows: CommentatorAthleteRow[];
    divisions: string[];
  }): JSX.Element;
  ```

- [ ] **Step 1: Write the failing test** `CommentatorAthletesTable.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.stubGlobal("matchMedia", (q: string) => ({
  matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
}));

import { CommentatorAthletesTable } from "./CommentatorAthletesTable";

const ROWS = [
  { id: "r1", name: "Maria Rivera", sortName: "Rivera Maria", bib: "12", division: "Intermediate Female", affiliate: "CrossFit Aprieta" },
  { id: "r2", name: "Ana López", sortName: "López Ana", bib: null, division: "Rx Female", affiliate: null },
];

afterEach(cleanup);

describe("CommentatorAthletesTable", () => {
  it("shows bib, division and affiliate", () => {
    render(<CommentatorAthletesTable rows={ROWS} divisions={["Intermediate Female", "Rx Female"]} />);
    expect(screen.getByText("#12")).toBeTruthy();
    expect(screen.getByText("CrossFit Aprieta")).toBeTruthy();
  });

  it("searches by name", async () => {
    render(<CommentatorAthletesTable rows={ROWS} divisions={["Intermediate Female", "Rx Female"]} />);
    await userEvent.setup().type(screen.getByRole("searchbox", { name: "Search athletes" }), "ana");
    expect(screen.queryByText("Maria Rivera")).toBeNull();
    expect(screen.getByText("Ana López")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it and see it fail.** Run `pnpm vitest run "src/app/(app)/commentator/events/[eventId]/athletes"`. Expected: FAIL, because the module is missing.

- [ ] **Step 3: Implement `CommentatorAthletesTable.tsx`.**

```tsx
"use client";

import { Users } from "lucide-react";
import { dataTableColumns } from "@/lib/data-table";
import { DataTable } from "@/components/app/data-table/DataTable";
import { EmptyState } from "@/components/app/EmptyState";

export type CommentatorAthleteRow = {
  id: string;
  name: string;
  /** "Last First", so the default order matches the roster. */
  sortName: string;
  bib: string | null;
  division: string;
  affiliate: string | null;
};

const col = dataTableColumns<CommentatorAthleteRow>();
const columns = [
  col.accessor((r) => `${r.sortName} ${r.name}`, {
    id: "athlete",
    header: "Athlete",
    cell: ({ row }) => <span className="font-semibold">{row.original.name}</span>,
  }),
  col.accessor((r) => r.bib ?? "", {
    id: "bib",
    header: "Bib",
    enableSorting: false,
    meta: { priority: "low" },
    cell: ({ getValue }) =>
      getValue() ? <span className="tabular-nums">#{getValue()}</span> : "—",
  }),
  col.accessor("division", { header: "Division", enableSorting: false, filterFn: "equals" }),
  col.accessor((r) => r.affiliate ?? "", {
    id: "affiliate",
    header: "Affiliate",
    enableSorting: false,
    meta: { priority: "low" },
    cell: ({ getValue }) => getValue() || "—",
  }),
];

export function CommentatorAthletesTable({
  rows,
  divisions,
}: {
  rows: CommentatorAthleteRow[];
  divisions: string[];
}) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      search={{ label: "Search athletes", placeholder: "Search by name, bib or affiliate…" }}
      initialSorting={[{ id: "athlete", desc: false }]}
      filters={[
        {
          columnId: "division",
          label: "Division",
          allLabel: "All divisions",
          options: divisions.map((d) => [d, d] as const),
        },
      ]}
      empty={<EmptyState icon={Users} title="No athletes registered for this event yet" />}
    />
  );
}
```

- [ ] **Step 4: Wire the Athletes page.** In `athletes/page.tsx`:
  1. Keep the query and the `Row` type.
  2. Remove the sort.
  3. Build the rows:

     ```ts
     const tableRows: CommentatorAthleteRow[] = ((registrations ?? []) as unknown as Row[]).map((r) => ({
       id: r.id,
       name: r.athletes ? `${r.athletes.first_name} ${r.athletes.last_name}` : (r.teams?.name ?? "—"),
       sortName: r.athletes ? `${r.athletes.last_name} ${r.athletes.first_name}` : (r.teams?.name ?? ""),
       bib: r.bib_number,
       division: r.divisions?.name ?? "—",
       affiliate: r.athletes?.affiliate ?? r.teams?.affiliate ?? null,
     }));
     const divisions = [...new Set(tableRows.map((r) => r.division))].sort();
     ```

  4. Replace the JSX between `<PageHeader title="Athletes" />` and the closing `</div>` with `<CommentatorAthletesTable rows={tableRows} divisions={divisions} />`.
  5. Drop the unused imports: `Users`, `EmptyState`, `Card`, `CardContent`.

- [ ] **Step 5: Turn the Lanes tab into tables.** In `lanes/page.tsx`, replace the `<ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">…</ul>` block with:

```tsx
                <div className="rounded-xl border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Lane</TableHead>
                        <TableHead>Athlete</TableHead>
                        <TableHead>Affiliate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lanes.map((l) => (
                        <TableRow key={l.laneNumber}>
                          <TableCell className="font-bold tabular-nums">{l.laneNumber}</TableCell>
                          <TableCell className="font-semibold whitespace-normal">{l.name}</TableCell>
                          <TableCell className="whitespace-normal text-muted-foreground">
                            {l.affiliate ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
```

  Keep everything after the `</ul>`, such as an empty-lanes line, unchanged. Replace the `Card` import with `import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";`.

- [ ] **Step 6: Generate the accordion.** Run `pnpm dlx shadcn@latest add accordion --yes`. Then:
  - Check `git diff package.json`. If the CLI added a `cn` dependency, revert `package.json` and `pnpm-lock.yaml` and run `pnpm install --frozen-lockfile`.
  - Change any `from "cn"` to `from "@/lib/utils"`.
  - If the trigger's height is under 44px, add `min-h-11` to `AccordionTrigger`'s classes.

- [ ] **Step 7: Turn the WODs tab into an accordion.** In `wods/page.tsx`, replace the `{wods.map((w) => (<Card …>…</Card>))}` block with:

```tsx
      {wods.length > 0 ? (
        <Accordion type="multiple" className="rounded-xl border border-border px-4">
          {wods.map((w) => (
            <AccordionItem key={w.id} value={w.id}>
              <AccordionTrigger className="min-h-11 text-left">
                <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-lg font-bold">{w.name}</span>
                  <Badge variant="outline" className="tracking-wide text-brand-text uppercase">
                    {wodSummary(w).slice(w.name.length + 3)}
                  </Badge>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                {w.description ? (
                  <p className="text-sm whitespace-pre-wrap">{w.description}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">No description on file.</p>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : null}
```

  - Keep the existing `wods.length === 0` empty state.
  - Imports: add `Accordion`, `AccordionContent`, `AccordionItem` and `AccordionTrigger` from `@/components/ui/accordion`, and `wodSummary` from `@/lib/scoring/format`. Remove `Card`, `CardContent`, `CardHeader` and `CardTitle`.
  - `wodSummary(w).slice(w.name.length + 3)` drops the leading `"Name · "`, leaving `For time · 15 min cap`.
  - Check `w`'s type: it needs `name`, `scoring_type` and `time_cap_seconds`, which today's page already reads.

- [ ] **Step 8: Run the tests and the check.** Run `pnpm vitest run "src/app/(app)/commentator" && pnpm check`. Expected: PASS.

- [ ] **Step 9: Commit.**

```bash
git add "src/app/(app)/commentator/events/[eventId]/lanes/page.tsx" "src/app/(app)/commentator/events/[eventId]/athletes/CommentatorAthletesTable.tsx" "src/app/(app)/commentator/events/[eventId]/athletes/CommentatorAthletesTable.test.tsx" "src/app/(app)/commentator/events/[eventId]/athletes/page.tsx" src/components/ui/accordion.tsx "src/app/(app)/commentator/events/[eventId]/wods/page.tsx"
pnpm check && git commit -m "The commentator's Lanes, Athletes and WODs read as a table, a searchable roster and an accordion

Lanes per floor are a table; the roster is a DataTable with search and
a division filter; each WOD opens to its description. The UI kit gains
shadcn's Accordion.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

  Stage `package.json` only if the accordion added a real dependency, such as `@radix-ui/react-accordion` when the `radix-ui` umbrella doesn't cover it.

---

### Task 4: Browser verification, final review, PR

- [ ] **Step 1: Run it in the browser** as `commentator@repone.test`, on `/commentator/events/<eventId>/dashboard`. Put the floor's heat on air first, as producer or through SQL, so the dashboard follows it.
  - At 1440×900, all 6 lane cards are visible without scrolling (`dash-1440.png`).
  - At 820×1180 (`dash-820.png`).
  - At 390×844, there is no horizontal scroll and no target under 44px (`dash-390.png`).
  - Open the WOD disclosure.
  - If no seeded athlete has 2 or more history events, check that "+N more events" stays absent.
  - Check the Lanes, Athletes (search plus division filter) and WODs (open one) tabs.
  - Run Lighthouse on the Dashboard tab, desktop and mobile. Accessibility must be at least 95.
- [ ] **Step 2: Clean up.** Reset the floor's `broadcast_state` if you changed it, and close the browser pages.
- [ ] **Step 3: Final review.**
  1. Run one whole-branch review on the most capable model.
  2. Fix Critical and Important findings, each with a test that fails first.
  3. Run `pnpm check` and commit, chained.
- [ ] **Step 4: Open the PR.**
  1. Push.
  2. Run `gh pr create --base staging`. The body says what changed, why, and how it was verified. It ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
  3. Stop at the PR link.
