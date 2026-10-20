# Live Standings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The live page gets two tabs, Now and Standings. Standings shows one division at a time with per-WOD placings and pinned columns, and the tab and division are kept in the URL. The commentator's Leaderboard opens on Standings.

**Architecture:**
- Two pure helpers: `ordinal` in `lib/scoring/format.ts` and `pivotStandings` in `lib/scoring/pivotStandings.ts`.
- A realtime hook, `useDivisionStandings`, built on the helpers.
- `LiveEventClient` is rewritten around shadcn `Tabs`, `Select`, `Table` and `Skeleton`.

**Tech Stack:** Next.js 16, React 19, the Supabase browser client with realtime, shadcn radix-vega, and Vitest 4.

**Spec:** `docs/superpowers/specs/2026-10-04-live-standings-design.md`

## Global Constraints

- **Branch and PR.** Work on `feat/live-standings`. Open the PR against `staging`.
- **Committing.** Every commit runs as `pnpm check && git commit …`, so a failing check never gets committed.
  - Stage files by name.
  - The message is a plain-sentence title, then a body saying why, then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Targets.** Every target and every table row is at least 44px. Names wrap at word boundaries.
- **Copy.** The UI copy is English. These strings are exact:
  - `Now`
  - `Standings`
  - `Division`
  - `No scored results yet. Standings fill in as heats are finished.`
  - `#`
  - `Athlete`
  - `Pts`
- **Out of scope.** The overlays keep `useStandings`, so it stays unchanged.

## Review Focus

1. **Invalid URL values.** A `?division=` that isn't in this event falls back to the first division, and an unknown `?tab=` falls back to the default. Pinned in Task 3.
2. **A competitor with per-WOD rows but no overall row.** They're left out of the table. Pinned in Task 1.
3. **Teams.** The pivot keys them by `team_id`. Pinned in Task 1.
4. **Switching division.** No rows from the previous division may stay on screen: the hook resets them and sets loading while it refetches. Pinned in Task 2's code and Task 3's skeleton test.
5. **The page at 390.** It must not scroll sideways; only the table wrapper scrolls. Checked in Task 4 (browser).

---

### Task 1: `ordinal` and `pivotStandings`

**Files:**
- Modify: `src/lib/scoring/format.ts` (append `ordinal`)
- Create: `src/lib/scoring/pivotStandings.ts`
- Test: `src/lib/scoring/format.test.ts` (append)
- Test: `src/lib/scoring/pivotStandings.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function ordinal(n: number): string;
  export interface RawStandingRow {
    wod_id: string | null; placement: number | null; points: number | null;
    athlete_id: string | null; team_id: string | null;
    athletes: { first_name: string; last_name: string } | null;
    teams: { name: string } | null;
    wods: { id: string; name: string; created_at: string } | null;
  }
  export interface StandingsWod { id: string; name: string }
  export interface DivisionStandingRow {
    key: string; placement: number | null; points: number | null; name: string;
    wodPlacements: Record<string, number | null>;
  }
  export function pivotStandings(raw: RawStandingRow[]): { wods: StandingsWod[]; rows: DivisionStandingRow[] };
  ```

- [ ] **Step 1: Write the failing tests.**

Append to `format.test.ts`, adding `ordinal` to the import:

```ts
describe("ordinal", () => {
  it.each([
    [1, "1st"], [2, "2nd"], [3, "3rd"], [4, "4th"], [11, "11th"], [12, "12th"],
    [13, "13th"], [21, "21st"], [22, "22nd"], [23, "23rd"], [101, "101st"], [111, "111th"],
  ])("%i is %s", (n, s) => expect(ordinal(n)).toBe(s));
});
```

Create `pivotStandings.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pivotStandings, type RawStandingRow } from "./pivotStandings";

const W1 = { id: "w1", name: "WOD 1", created_at: "2026-01-01T00:00:00Z" };
const W2 = { id: "w2", name: "WOD 2", created_at: "2026-01-02T00:00:00Z" };
const athlete = (id: string, first: string, last: string) => ({
  athlete_id: id, team_id: null, athletes: { first_name: first, last_name: last }, teams: null,
});
const row = (o: Partial<RawStandingRow> & Pick<RawStandingRow, "athlete_id">): RawStandingRow => ({
  wod_id: null, placement: null, points: null, team_id: null, athletes: null, teams: null, wods: null, ...o,
});

describe("pivotStandings", () => {
  it("is empty for no rows", () => expect(pivotStandings([])).toEqual({ wods: [], rows: [] }));

  it("orders overall rows by placement, nulls last, and attaches WOD placings", () => {
    const out = pivotStandings([
      row({ ...athlete("a", "Maria", "Rivera"), placement: 2, points: 4 }),
      row({ ...athlete("b", "Sofia", "Delgado"), placement: 1, points: 3 }),
      row({ ...athlete("c", "Camila", "Ortiz"), placement: null, points: null }),
      row({ ...athlete("a", "Maria", "Rivera"), wod_id: "w2", placement: 1, wods: W2 }),
      row({ ...athlete("a", "Maria", "Rivera"), wod_id: "w1", placement: 3, wods: W1 }),
      row({ ...athlete("b", "Sofia", "Delgado"), wod_id: "w1", placement: 1, wods: W1 }),
    ]);
    expect(out.wods).toEqual([{ id: "w1", name: "WOD 1" }, { id: "w2", name: "WOD 2" }]);
    expect(out.rows.map((r) => r.name)).toEqual(["Sofia Delgado", "Maria Rivera", "Camila Ortiz"]);
    expect(out.rows[1]).toEqual({
      key: "a", placement: 2, points: 4, name: "Maria Rivera", wodPlacements: { w1: 3, w2: 1 },
    });
    expect(out.rows[0].wodPlacements).toEqual({ w1: 1 });
  });

  it("keys teams by team id", () => {
    const team = { athlete_id: null, team_id: "t1", athletes: null, teams: { name: "Box 787 Pair" } };
    const out = pivotStandings([
      row({ ...team, placement: 1, points: 1 }),
      row({ ...team, wod_id: "w1", placement: 1, wods: W1 }),
    ]);
    expect(out.rows).toEqual([
      { key: "t1", placement: 1, points: 1, name: "Box 787 Pair", wodPlacements: { w1: 1 } },
    ]);
  });

  it("leaves out a competitor with WOD rows but no overall row", () => {
    const out = pivotStandings([row({ ...athlete("z", "Zoe", "Zayas"), wod_id: "w1", placement: 4, wods: W1 })]);
    expect(out.rows).toEqual([]);
    expect(out.wods).toEqual([{ id: "w1", name: "WOD 1" }]);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail.** Command: `pnpm vitest run src/lib/scoring`. Expected: FAIL, because the imports are missing.

- [ ] **Step 3: Implement.**

Append to `format.ts`:

```ts
/** 1 → "1st", 12 → "12th", 22 → "22nd": a placing as people say it. */
export function ordinal(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  const suffix = ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}
```

Create `pivotStandings.ts`:

```ts
export interface RawStandingRow {
  wod_id: string | null;
  placement: number | null;
  points: number | null;
  athlete_id: string | null;
  team_id: string | null;
  athletes: { first_name: string; last_name: string } | null;
  teams: { name: string } | null;
  wods: { id: string; name: string; created_at: string } | null;
}

export interface StandingsWod {
  id: string;
  name: string;
}

export interface DivisionStandingRow {
  /** The athlete's or team's id. */
  key: string;
  placement: number | null;
  points: number | null;
  name: string;
  /** Placing in each WOD, by WOD id. */
  wodPlacements: Record<string, number | null>;
}

/**
 * A division's standings rows (overall and per WOD, as stored) turned into one
 * row per competitor with a placing for each WOD. The overall row is the
 * leaderboard: a competitor with only per-WOD rows is left out. WOD columns
 * follow running order (created_at), as in divisionOrder.ts.
 */
export function pivotStandings(raw: RawStandingRow[]): {
  wods: StandingsWod[];
  rows: DivisionStandingRow[];
} {
  const wods = new Map<string, { id: string; name: string; created_at: string }>();
  const byKey = new Map<string, DivisionStandingRow>();
  const placings: Array<{ key: string; wodId: string; placement: number | null }> = [];

  for (const r of raw) {
    const key = r.athlete_id ?? r.team_id;
    if (!key) continue;
    if (r.wod_id === null) {
      byKey.set(key, {
        key,
        placement: r.placement,
        points: r.points,
        name: r.athletes ? `${r.athletes.first_name} ${r.athletes.last_name}` : (r.teams?.name ?? "—"),
        wodPlacements: {},
      });
    } else {
      if (r.wods) wods.set(r.wod_id, r.wods);
      placings.push({ key, wodId: r.wod_id, placement: r.placement });
    }
  }
  for (const p of placings) {
    const competitor = byKey.get(p.key);
    if (competitor) competitor.wodPlacements[p.wodId] = p.placement;
  }

  const rows = [...byKey.values()].sort((a, b) => {
    if (a.placement === null && b.placement === null) return a.name.localeCompare(b.name, "es");
    if (a.placement === null) return 1;
    if (b.placement === null) return -1;
    return a.placement - b.placement;
  });
  return {
    wods: [...wods.values()]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(({ id, name }) => ({ id, name })),
    rows,
  };
}
```

- [ ] **Step 4: Run the tests and confirm they pass.** Command: `pnpm vitest run src/lib/scoring`. Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/scoring/format.ts src/lib/scoring/format.test.ts src/lib/scoring/pivotStandings.ts src/lib/scoring/pivotStandings.test.ts
pnpm check && git commit -m "Standings can be read as one row per competitor with each WOD's placing

The live table puts every WOD's placing beside the overall points; one
helper pivots the stored rows into that shape, and another says a
placing the way people do (1st, 2nd, 3rd).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `useDivisionStandings`

**Files:**
- Create: `src/lib/realtime/useDivisionStandings.ts`

**Interfaces:**
- Consumes: Task 1's `pivotStandings` and its types.
- Produces: `useDivisionStandings(divisionId: string | null): { wods: StandingsWod[]; rows: DivisionStandingRow[]; loading: boolean }`

This hook has no unit test of its own. It is the Supabase client plus a realtime channel, the same shape as `useStandings`, which has none either. Task 3's component tests mock it. The live update is checked in the browser in Task 4.

- [ ] **Step 1: Implement.**

```ts
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/db/client";
import {
  type DivisionStandingRow,
  pivotStandings,
  type RawStandingRow,
  type StandingsWod,
} from "@/lib/scoring/pivotStandings";

const EMPTY = { wods: [] as StandingsWod[], rows: [] as DivisionStandingRow[] };

/**
 * A division's live standings: overall place and points, plus each WOD's
 * placing. Refetches whenever `standings` changes for the division, so a saved
 * result reaches the live page without a refresh. The overlays keep
 * useStandings (overall only).
 */
export function useDivisionStandings(divisionId: string | null) {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(Boolean(divisionId));

  useEffect(() => {
    // A new division starts empty and loading, so the previous one's rows never show under it.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on division change
    setData(EMPTY);
    setLoading(Boolean(divisionId));
    if (!divisionId) return;
    const division = divisionId;
    const supabase = createClient();
    let cancelled = false;

    async function load() {
      const { data: raw } = await supabase
        .from("standings")
        .select(
          "wod_id, placement, points, athlete_id, team_id, athletes(first_name, last_name), teams(name), wods(id, name, created_at)",
        )
        .eq("division_id", division);
      if (cancelled) return;
      // See lib/db/queries.ts header comment: many-to-one embeds come back as single objects.
      setData(pivotStandings((raw ?? []) as unknown as RawStandingRow[]));
      setLoading(false);
    }

    load();
    const channel = supabase
      .channel(`division-standings:${division}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "standings", filter: `division_id=eq.${division}` },
        () => load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [divisionId]);

  return { ...data, loading };
}
```

If ESLint flags the second `setLoading` in the effect as well, extend the disable comment to cover both lines with a block-level `/* eslint-disable … */` and `/* eslint-enable */`. Don't restructure.

- [ ] **Step 2: Typecheck.** Command: `pnpm typecheck`. Expected: PASS.

- [ ] **Step 3: Commit.**

```bash
git add src/lib/realtime/useDivisionStandings.ts
pnpm check && git commit -m "A division's live standings come with each WOD's placing

A realtime hook like useStandings that also reads the per-WOD rows and
pivots them, and clears the previous division's rows while it loads.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `LiveEventClient` with tabs, division picker and the standings table

**Files:**
- Rewrite: `src/app/(app)/live/[eventId]/LiveEventClient.tsx`
- Modify: `src/app/(app)/commentator/events/[eventId]/leaderboard/page.tsx` (`defaultTab="standings"`)
- Test: `src/app/(app)/live/[eventId]/LiveEventClient.test.tsx`

**Interfaces:**
- Consumes:
  - Task 2's `useDivisionStandings`.
  - Task 1's `ordinal`.
  - `useFloorOverlay` and `useLiveTimer`, unchanged.
- Produces: `LiveEventClient({ floors, divisions, defaultTab? })`.

- [ ] **Step 1: Write the failing test.**

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
vi.mock("@/lib/realtime/useFloorOverlay", () => ({
  useFloorOverlay: () => ({ state: null, connected: true, currentHeat: null }),
}));
vi.mock("@/lib/realtime/useLiveTimer", () => ({
  useLiveTimer: () => ({ displaySeconds: 0, atLimit: false }),
}));
const standings = vi.hoisted(() => ({
  current: (_id: string | null) => ({
    loading: false,
    wods: [{ id: "w1", name: "WOD 1" }],
    rows: [{ key: "a", placement: 1, points: 3, name: "Maria Rivera", wodPlacements: { w1: 2 } }],
  }),
}));
vi.mock("@/lib/realtime/useDivisionStandings", () => ({
  useDivisionStandings: (id: string | null) => standings.current(id),
}));

import { LiveEventClient } from "./LiveEventClient";

const DIVISIONS = [
  { id: "d1", name: "Intermediate Female" },
  { id: "d2", name: "Rx Male" },
];
const FLOORS = [
  { floorId: "f", floorName: "Floor A", venueName: "Main", heats: [], initialBroadcastState: null },
] as never;

let replace: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  window.history.pushState({}, "", "/live/ev");
  replace = vi.spyOn(window.history, "replaceState");
});
afterEach(() => {
  cleanup();
  replace.mockRestore();
});

describe("LiveEventClient", () => {
  it("opens on Now and switches to Standings, keeping it in the URL", async () => {
    render(<LiveEventClient floors={FLOORS} divisions={DIVISIONS} />);
    expect(screen.getByRole("tab", { name: "Now", selected: true })).toBeTruthy();
    await userEvent.setup().click(screen.getByRole("tab", { name: "Standings" }));
    expect(screen.getByRole("tab", { name: "Standings", selected: true })).toBeTruthy();
    expect(String(replace.mock.calls.at(-1)?.[2])).toContain("tab=standings");
  });

  it("opens the tab and division the link names, with WOD placings", () => {
    window.history.pushState({}, "", "/live/ev?tab=standings&division=d2");
    const seen: Array<string | null> = [];
    standings.current = (id) => {
      seen.push(id);
      return {
        loading: false,
        wods: [{ id: "w1", name: "WOD 1" }],
        rows: [{ key: "a", placement: 1, points: 3, name: "Maria Rivera", wodPlacements: { w1: 2 } }],
      };
    };
    render(<LiveEventClient floors={FLOORS} divisions={DIVISIONS} />);
    expect(screen.getByRole("tab", { name: "Standings", selected: true })).toBeTruthy();
    expect(seen).toContain("d2");
    expect(screen.getByText("2nd")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "WOD 1" })).toBeTruthy();
    expect(screen.getByText("Maria Rivera")).toBeTruthy();
  });

  it("falls back to the first division for one that isn't in this event", () => {
    window.history.pushState({}, "", "/live/ev?tab=standings&division=nope");
    const seen: Array<string | null> = [];
    standings.current = (id) => {
      seen.push(id);
      return { loading: false, wods: [], rows: [] };
    };
    render(<LiveEventClient floors={FLOORS} divisions={DIVISIONS} />);
    expect(seen.at(-1)).toBe("d1");
    expect(
      screen.getByText("No scored results yet. Standings fill in as heats are finished."),
    ).toBeTruthy();
  });

  it("opens on Standings when the page asks for it, and shows skeletons while loading", () => {
    standings.current = () => ({ loading: true, wods: [], rows: [] });
    render(<LiveEventClient floors={FLOORS} divisions={DIVISIONS} defaultTab="standings" />);
    expect(screen.getByRole("tab", { name: "Standings", selected: true })).toBeTruthy();
    expect(screen.getAllByTestId("standings-skeleton").length).toBe(3);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails.** Command: `pnpm vitest run "src/app/(app)/live"`. Expected: FAIL, because there are no tabs yet.

- [ ] **Step 3: Rewrite `LiveEventClient.tsx`.** Keep `FloorNowCompeting` exactly as it is today: its imports, its body, and its timer. Replace the rest:

```tsx
"use client";

import { useEffect, useState } from "react";
import { ListOrdered, Timer } from "lucide-react";
import { useFloorOverlay } from "@/lib/realtime/useFloorOverlay";
import { useLiveTimer } from "@/lib/realtime/useLiveTimer";
import { useDivisionStandings } from "@/lib/realtime/useDivisionStandings";
import { ordinal } from "@/lib/scoring/format";
import { TimerDisplay } from "@/components/graphics/TimerDisplay";
import { EmptyState } from "@/components/app/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { EventLiveFloor } from "@/lib/db/queries";
import { cn } from "@/lib/utils";

type LiveTab = "now" | "standings";

/** The URL's ?tab= and ?division=, read once on mount; anything unknown falls back. */
function initialFromUrl(defaultTab: LiveTab, divisionIds: string[]) {
  if (typeof window === "undefined") return { tab: defaultTab, division: divisionIds[0] ?? null };
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  const division = params.get("division");
  return {
    tab: tab === "now" || tab === "standings" ? tab : defaultTab,
    division: division && divisionIds.includes(division) ? division : (divisionIds[0] ?? null),
  };
}

/** Keeps the tab and division in the URL without navigating, so a link opens the same view. */
function writeUrl(key: "tab" | "division", value: string) {
  const url = new URL(window.location.href);
  url.searchParams.set(key, value);
  window.history.replaceState(window.history.state, "", url);
}

// Public, read-only live view for spectators and athletes (and the
// commentator's Leaderboard tab): what's on each floor now, and one division's
// standings with each WOD's placing. Reuses the realtime hooks the overlays
// use, so it updates the moment a heat advances or a result is saved.
export function LiveEventClient({
  floors,
  divisions,
  defaultTab = "now",
}: {
  floors: EventLiveFloor[];
  divisions: Array<{ id: string; name: string }>;
  defaultTab?: LiveTab;
}) {
  const [tab, setTab] = useState<LiveTab>(defaultTab);
  const [divisionId, setDivisionId] = useState<string | null>(divisions[0]?.id ?? null);
  // The server renders the defaults; the URL's choice is applied once on mount,
  // so the first client render matches the server's.
  const divisionKey = divisions.map((d) => d.id).join(",");
  useEffect(() => {
    const fromUrl = initialFromUrl(defaultTab, divisionKey ? divisionKey.split(",") : []);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync from the URL once on mount
    setTab(fromUrl.tab);
    setDivisionId(fromUrl.division);
  }, [defaultTab, divisionKey]);

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => {
        setTab(v as LiveTab);
        writeUrl("tab", v);
      }}
      className="flex flex-col gap-6"
    >
      <TabsList className="w-full sm:w-fit">
        <TabsTrigger value="now" className="min-h-11 flex-1 sm:flex-none sm:px-6">
          Now
        </TabsTrigger>
        <TabsTrigger value="standings" className="min-h-11 flex-1 sm:flex-none sm:px-6">
          Standings
        </TabsTrigger>
      </TabsList>

      <TabsContent value="now" className="flex flex-col gap-4">
        <h2 className="sr-only">Now competing</h2>
        {floors.map((floor) => (
          <FloorNowCompeting key={floor.floorId} floor={floor} />
        ))}
        {floors.length === 0 && (
          <EmptyState
            icon={Timer}
            title="No floors set up yet"
            description="The current heat shows here once the organizer sets up the floors."
          />
        )}
      </TabsContent>

      <TabsContent value="standings" className="flex flex-col gap-4">
        <h2 className="sr-only">Standings</h2>
        {divisions.length === 0 ? (
          <EmptyState
            icon={ListOrdered}
            title="No divisions set up yet"
            description="Standings show here once the organizer adds divisions."
          />
        ) : (
          <>
            {divisions.length > 1 && (
              <div className="grid gap-2 sm:w-72">
                <Label htmlFor="live-division">Division</Label>
                <Select
                  value={divisionId ?? undefined}
                  onValueChange={(v) => {
                    setDivisionId(v);
                    writeUrl("division", v);
                  }}
                >
                  <SelectTrigger id="live-division" className="w-full data-[size=default]:h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {divisions.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <DivisionStandings divisionId={divisionId} />
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}

const PIN = "sticky z-10 bg-card";

function DivisionStandings({ divisionId }: { divisionId: string | null }) {
  const { wods, rows, loading } = useDivisionStandings(divisionId);

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} data-testid="standings-skeleton" className="h-11 w-full" />
        ))}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No scored results yet. Standings fill in as heats are finished.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <Table className="[&_tr]:border-border">
        <TableHeader>
          <TableRow>
            <TableHead className={cn(PIN, "left-0 w-12")}>#</TableHead>
            <TableHead className={cn(PIN, "left-12 min-w-40")}>Athlete</TableHead>
            {wods.map((w) => (
              <TableHead key={w.id} className="text-center whitespace-nowrap">
                {w.name}
              </TableHead>
            ))}
            <TableHead className="text-right">Pts</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.key} className="h-11">
              <TableCell className={cn(PIN, "left-0 w-12 font-bold text-brand-text tabular-nums")}>
                {r.placement ?? "—"}
              </TableCell>
              <TableCell className={cn(PIN, "left-12 min-w-40 font-semibold whitespace-normal")}>
                {r.name}
              </TableCell>
              {wods.map((w) => {
                const p = r.wodPlacements[w.id];
                return (
                  <TableCell key={w.id} className="text-center text-muted-foreground tabular-nums">
                    {p ? ordinal(p) : "—"}
                  </TableCell>
                );
              })}
              <TableCell className="text-right font-semibold tabular-nums">
                {r.points ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

Two notes on this code:
- **`FloorNowCompeting`** stays below exactly as it is today. Its imports (`useFloorOverlay`, `useLiveTimer`, `TimerDisplay`, `Card…`, `cn`) are already in the list above.
- **The URL is read in an effect on mount, not in `useState`.** The server renders `defaultTab` and the first division, so the first client render must match it. Reading the URL during render could cause a hydration mismatch when the link names another tab.

- [ ] **Step 4: Open the commentator's Leaderboard on Standings.** In `commentator/events/[eventId]/leaderboard/page.tsx`, change `<LiveEventClient floors={context.floors} divisions={context.divisions} />` to also pass `defaultTab="standings"`.

- [ ] **Step 5: Run the tests and confirm they pass.** Command: `pnpm vitest run "src/app/(app)/live"`. Expected: PASS, 4 tests.

  The URL test reads `window.location` in the effect on mount. `render` flushes effects, so `seen` contains `"d2"` after the effect runs. That's why the test asserts `toContain`: the first render asks for d1.

- [ ] **Step 6: Commit.**

```bash
git add "src/app/(app)/live/[eventId]/LiveEventClient.tsx" "src/app/(app)/live/[eventId]/LiveEventClient.test.tsx" "src/app/(app)/commentator/events/[eventId]/leaderboard/page.tsx"
pnpm check && git commit -m "The live page is Now and Standings, one division at a time

Spectators pick a division instead of scrolling past every other one,
see each WOD's placing beside the total with the athlete pinned while
the WODs scroll, and a shared link opens the same tab and division.
The commentator's Leaderboard opens on Standings.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Browser verification, final review and PR

- [ ] **Step 1: Create test data.** As `scorekeeper@repone.test`, enter results for two lanes through the drawer. Or insert results and call the standings recompute. Either way, overall and per-WOD standings rows must exist.
- [ ] **Step 2: Run the browser checks** on `/live/<eventId>`, signed out:
  1. At 390×844, open the Now tab, then Standings.
  2. Scroll the table wrapper sideways and check that # and Athlete stay pinned (`standings-390.png`). Check that `document.documentElement.scrollWidth` is 390.
  3. At 1440 (`standings-1440.png`).
  4. Reload with `?tab=standings&division=<id>` and check that the same tab and division come back.
  5. With the page open, save another result as scorekeeper and check that the table updates.
  6. Open the commentator's Leaderboard tab and check that it opens on Standings.
  7. Run Lighthouse on mobile. Accessibility must be ≥ 95.
- [ ] **Step 3: Clean up.** Delete the test results and the standings for that WOD and division, and close the browser pages.
- [ ] **Step 4: Final review.** Run one whole-branch review on the most capable model. Fix Critical and Important findings, each with a failing test first, then run `pnpm check` and commit as a chain.
- [ ] **Step 5: Open the PR.** Push, then run `gh pr create --base staging`. The body says what changed, why, and how it was verified, and ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Stop at the PR link.
