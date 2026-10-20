# Production Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The producer's live board becomes a two-column control board with a sticky On air bar. A timer restart and a heat switch while timing ask first. The broadcast actions return `ActionResult`. The producer's read-only tabs become tables.

**Architecture:**
- **Pure helpers.** `onAir.ts` summarizes `broadcast_state` for the bar and decides when to confirm.
- **`OnAirBar`.** The sticky bar that shows what is on air.
- **`DashboardClient`.** Rewritten into "floor | audience" columns, with the confirmations wired in.
- **`broadcast.ts`.** Moves to `safeAction`.
- **Producer tabs.**
  - Scores becomes a `DataTable` (`ScoresTable`).
  - Heats, Sponsors and Commentary become shadcn `Table`s.
  - Broadcast becomes a redirect.

**Tech Stack:** Next.js 16 App Router, React 19, shadcn `radix-vega` (`ToggleGroup`, `Table`), TanStack Table v9 via `DataTable`, Vitest 4 with Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-04-production-board-design.md`

## Global Constraints

**Branch and PR**
- Work on `feat/production-board` and open the PR against `staging`.

**Commits**
- `pnpm check` passes before every commit. Chain them: `pnpm check && git commit …`.
- Stage files by name.
- The title is a plain sentence saying what is now true. The body says why. It ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Sizes**
- Live controls are at least 56px (`min-h-14`).
- Every other target is at least 44px.

**UI copy (English, exact)**
- `No heat on air`
- `Put Heat ${n} on air`
- `Switch to Heat ${n}?` / `The timer is ${running|paused} for Heat ${m}. Switching heats doesn't stop it.` / `Switch heat`
- `Restart the timer?` / `The clock is at ${mm:ss}. Restarting sets it back to the start, on the board and on air.` / `Restart timer`
- `Clear all`
- `This floor's broadcast controls aren't available to your account.`

**Actions**
- They never `throw` a literal message and never `redirect()`.
- The ignored `_eventId` parameter is removed from every broadcast action.

**Tests**
- Every jsdom test starts with `// @vitest-environment jsdom`.
- Mock `ResizeObserver` and `matchMedia` where Radix or the media query needs them.

## Rulings made while planning

- **The Scores table test covers search plus the score, status and adjusted cells, not the status filter Select.** Radix Select is not driven in jsdom anywhere in this repo. The filter is the shared `DataTable` mechanism, which `DataTable.test.tsx` already covers. If this is wrong, a filter regression shows up only in the browser run (Task 6 checks the filter there).

## Review Focus

1. **The timer running when the producer presses Start or Previous/Next.** The confirmation must appear. Idle or ended must not ask. Pinned in Task 2 (helpers) and Task 4 (component).
2. **A lower-third athlete or sponsor id that no longer resolves.** The bar must say "On air", not crash or show "None". Pinned in Task 2.
3. **A broadcast update that matches no row** (RLS denied, or no broadcast state). The producer must see the "not available" message. Pinned in Task 1 (action) and Task 4 (alert).
4. **No heat on air.** The bar must say so and offer Put on air, and Put on air must never ask. Pinned in Task 3 and Task 4.
5. **Old `/broadcast` bookmarks.** They must land on Production. Checked in Task 6 (browser).

---

### Task 1: Broadcast actions return `ActionResult`

**Files:**
- Rewrite: `src/lib/actions/broadcast.ts`, from line 59 (`updateBroadcastState`) to the end of the file
- Modify: `src/lib/design/uiGuard.ts` (`ACTION_RESULT_FILES`)
- Modify (stopgap call sites, rewritten in Task 4): `src/app/(app)/dashboard/[floorId]/DashboardClient.tsx`
- Test: `src/lib/actions/broadcast.test.ts`

**Interfaces:**
- Produces, each returning `Promise<ActionResult>`:
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

- [ ] **Step 1: Write the failing test** `src/lib/actions/broadcast.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./testing/fakeSupabase";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.current }));
vi.mock("@/lib/auth/guards", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/guards")>()),
  requireFloorAccess: async (floorId: string) => ({
    ctx: { userId: "u-1" },
    eventId: "ev-1",
    organizationId: "org-1",
    floorId,
  }),
}));

import { clearGraphics, setActiveGraphic, setCurrentHeat, startTimer } from "./broadcast";

const FLOOR = "00000000-0000-4000-8000-000000000030";
const HEAT = "00000000-0000-4000-8000-000000000070";

beforeEach(() => vi.clearAllMocks());

describe("broadcast actions", () => {
  it("refuses a heat that isn't on the floor", async () => {
    db.current = fakeSupabase({ heats: [{ data: null }] }).client;
    expect(await setCurrentHeat(FLOOR, HEAT)).toEqual({
      ok: false,
      message: "That heat isn't on this floor.",
    });
  });

  it("puts a heat on air", async () => {
    db.current = fakeSupabase({
      heats: [{ data: { id: HEAT } }],
      broadcast_state: [{ data: [{ floor_id: FLOOR }] }],
    }).client;
    expect(await setCurrentHeat(FLOOR, HEAT)).toEqual({ ok: true });
  });

  it("shows a graphic", async () => {
    db.current = fakeSupabase({ broadcast_state: [{ data: [{ floor_id: FLOOR }] }] }).client;
    expect(await setActiveGraphic(FLOOR, "lanes")).toEqual({ ok: true });
  });

  it("says so when the floor's controls aren't this account's", async () => {
    db.current = fakeSupabase({ broadcast_state: [{ data: [] }] }).client;
    expect(await setActiveGraphic(FLOOR, "lanes")).toEqual({
      ok: false,
      message: "This floor's broadcast controls aren't available to your account.",
    });
  });

  it("clears the graphics", async () => {
    db.current = fakeSupabase({ broadcast_state: [{ data: [{ floor_id: FLOOR }] }] }).client;
    expect(await clearGraphics(FLOOR)).toEqual({ ok: true });
  });

  it("names a bad timer duration", async () => {
    db.current = fakeSupabase({}).client;
    const result = await startTimer(FLOOR, "count_down", 1.5);
    expect(result).toEqual({ ok: false, message: "Timer duration must be whole seconds." });
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.** Command: `pnpm vitest run src/lib/actions/broadcast.test.ts`. Expected: FAIL, because the actions return `undefined` or throw.

- [ ] **Step 3: Rewrite the actions.** In `broadcast.ts`:
  - Add imports `import { type ActionResult, fail, ok } from "@/lib/action-result";` and `import { safeAction } from "./safeAction";`.
  - Remove the `NotAuthorizedError` import.
  - Replace the paragraph comment above `const Id` with:
    ```ts
    // Every action here is driven from the producer's board: an org manager or
    // a producer assigned to the floor's event may run it (requireFloorAccess).
    // The event is resolved from the floor on the server; it's what goes into
    // the operator log.
    ```
  - Replace everything from the `updateBroadcastState` doc comment to the end of the file with:

```ts
const NOT_AVAILABLE = "This floor's broadcast controls aren't available to your account.";

/**
 * Every write to a floor's broadcast_state goes through here. False when the
 * update matched no row (floor without broadcast state, or RLS denying this
 * user), which used to "succeed" silently.
 */
async function updateBroadcastState(
  supabase: SupabaseServerClient,
  floorId: string,
  patch: BroadcastStatePatch,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("broadcast_state")
    .update(patch)
    .eq("floor_id", floorId)
    .select("floor_id");
  if (error) throw new Error(error.message);
  return Boolean(data?.length);
}

/** Operator selects WOD -> Heat: this one write prepares every downstream graphic. */
export async function setCurrentHeat(floorId: string, heatId: string): Promise<ActionResult> {
  return safeAction(async () => {
    const { ctx, eventId } = await requireFloorAccess(floorId, ["producer"]);
    parseArg(Id("Heat"), heatId);

    const supabase = await createClient();
    const { data: heat, error } = await supabase
      .from("heats")
      .select("id")
      .eq("id", heatId)
      .eq("floor_id", floorId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!heat) return fail("That heat isn't on this floor.");

    if (!(await updateBroadcastState(supabase, floorId, { current_heat_id: heatId }))) {
      return fail(NOT_AVAILABLE);
    }
    await logAction(supabase, ctx.userId, eventId, floorId, "heat_change", { heatId });
    return ok();
  });
}

export async function setActiveGraphic(
  floorId: string,
  graphic: ActiveGraphic,
): Promise<ActionResult> {
  return safeAction(async () => {
    const { ctx, eventId } = await requireFloorAccess(floorId, ["producer"]);
    const active_graphic = parseArg(Graphic, graphic);

    const supabase = await createClient();
    if (!(await updateBroadcastState(supabase, floorId, { active_graphic }))) {
      return fail(NOT_AVAILABLE);
    }
    await logAction(supabase, ctx.userId, eventId, floorId, "graphic_show", {
      graphic: active_graphic,
    });
    return ok();
  });
}

export async function setLowerThird(
  floorId: string,
  athleteId: string | null,
): Promise<ActionResult> {
  return safeAction(async () => {
    const { ctx, eventId } = await requireFloorAccess(floorId, ["producer"]);
    const supabase = await createClient();

    if (athleteId !== null) {
      parseArg(Id("Athlete"), athleteId);
      // Only someone laned in a heat on this floor can be put on screen here.
      const { data: lane, error } = await supabase
        .from("lanes")
        .select("id, heats!inner(floor_id)")
        .eq("athlete_id", athleteId)
        .eq("heats.floor_id", floorId)
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!lane) return fail("That athlete isn't in a heat on this floor.");
    }

    const changed = await updateBroadcastState(supabase, floorId, {
      lower_third_athlete_id: athleteId,
      active_graphic: athleteId ? "lower_third" : "none",
    });
    if (!changed) return fail(NOT_AVAILABLE);
    await logAction(
      supabase,
      ctx.userId,
      eventId,
      floorId,
      athleteId ? "lower_third_show" : "lower_third_hide",
      { athleteId },
    );
    return ok();
  });
}

export async function setActiveSponsor(
  floorId: string,
  sponsorId: string | null,
): Promise<ActionResult> {
  return safeAction(async () => {
    const { ctx, eventId, organizationId } = await requireFloorAccess(floorId, ["producer"]);
    const supabase = await createClient();

    if (sponsorId !== null) {
      parseArg(Id("Sponsor"), sponsorId);
      // Same scope the board lists: the event's org, for this event or org-wide.
      const { data: sponsor, error } = await supabase
        .from("sponsors")
        .select("id, event_id")
        .eq("id", sponsorId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!sponsor || (sponsor.event_id !== null && sponsor.event_id !== eventId)) {
        return fail("That sponsor isn't part of this event.");
      }
    }

    const changed = await updateBroadcastState(supabase, floorId, {
      active_sponsor_id: sponsorId,
      active_graphic: sponsorId ? "sponsor" : "none",
    });
    if (!changed) return fail(NOT_AVAILABLE);
    await logAction(supabase, ctx.userId, eventId, floorId, "sponsor_show", { sponsorId });
    return ok();
  });
}

export async function clearGraphics(floorId: string): Promise<ActionResult> {
  return safeAction(async () => {
    const { ctx, eventId } = await requireFloorAccess(floorId, ["producer"]);
    const supabase = await createClient();
    const changed = await updateBroadcastState(supabase, floorId, {
      active_graphic: "none",
      lower_third_athlete_id: null,
      active_sponsor_id: null,
    });
    if (!changed) return fail(NOT_AVAILABLE);
    await logAction(supabase, ctx.userId, eventId, floorId, "clear_graphics");
    return ok();
  });
}

// ---------------------------------------------------------------------------
// Timer — server-authoritative. Every transition runs in timer_command()
// (0027_timer_command.sql): one locked row, the database clock, and commands
// that don't apply to the current state (resume while running, pause while
// idle) are no-ops. Clients derive the display from the anchor with
// src/lib/timer/compute.ts; nothing runs its own countdown.
// ---------------------------------------------------------------------------

type FloorAccess = Awaited<ReturnType<typeof requireFloorAccess>>;

async function timerCommand(
  { ctx, eventId, floorId }: FloorAccess,
  command: "start" | "pause" | "resume" | "reset" | "adjust",
  args: {
    p_direction?: TimerDirection;
    p_duration_seconds?: number;
    p_delta_seconds?: number;
  } = {},
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("timer_command", {
    p_floor_id: floorId,
    p_command: command,
    ...args,
  });
  if (error) throw new Error(error.message);
  await logAction(supabase, ctx.userId, eventId, floorId, `timer_${command}`, args);
  return ok();
}

export async function startTimer(
  floorId: string,
  direction: TimerDirection,
  durationSeconds: number,
): Promise<ActionResult> {
  return safeAction(async () => {
    const access = await requireFloorAccess(floorId, ["producer"]);
    return timerCommand(access, "start", {
      p_direction: parseArg(Direction, direction),
      p_duration_seconds: parseArg(Duration, durationSeconds),
    });
  });
}

export async function pauseTimer(floorId: string): Promise<ActionResult> {
  return safeAction(async () =>
    timerCommand(await requireFloorAccess(floorId, ["producer"]), "pause"),
  );
}

export async function resumeTimer(floorId: string): Promise<ActionResult> {
  return safeAction(async () =>
    timerCommand(await requireFloorAccess(floorId, ["producer"]), "resume"),
  );
}

export async function resetTimer(floorId: string): Promise<ActionResult> {
  return safeAction(async () =>
    timerCommand(await requireFloorAccess(floorId, ["producer"]), "reset"),
  );
}

/** +/- adjustment (in seconds) applied to the timer while preserving running/paused state. */
export async function adjustTimer(floorId: string, deltaSeconds: number): Promise<ActionResult> {
  return safeAction(async () => {
    const access = await requireFloorAccess(floorId, ["producer"]);
    return timerCommand(access, "adjust", { p_delta_seconds: parseArg(Delta, deltaSeconds) });
  });
}
```

- [ ] **Step 4: Add `broadcast.ts` to the guard.** In `uiGuard.ts`'s `ACTION_RESULT_FILES`, add `"src/lib/actions/broadcast.ts",` after `"src/lib/actions/results.ts",`.

- [ ] **Step 5: Stopgap call sites in `DashboardClient.tsx`.** Task 4 rewrites this file, so only make it compile and behave:
  1. Remove the trailing `, eventId` argument from every broadcast action call. Examples: `setCurrentHeat(floorId, heat.id)`, `startTimer(floorId, countDirection, …)`.
  2. In `go`, replace `await action();` with `const result = await action(); if (result && typeof result === "object" && "ok" in result && !result.ok) setFailure(String((result as { message: unknown }).message));`. Task 4 replaces this with a typed version.
  3. In `confirmed`, return the result: `return await action();`.
  4. If `eventId` becomes an unused prop, prefix it with `_eventId` in the destructure.

- [ ] **Step 6: Run the checks.** Commands: `pnpm vitest run src/lib/actions/broadcast.test.ts && pnpm ui:guard`. Expected: 6 passed and `ui-guard: clean`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/actions/broadcast.ts src/lib/actions/broadcast.test.ts src/lib/design/uiGuard.ts "src/app/(app)/dashboard/[floorId]/DashboardClient.tsx"
pnpm check && git commit -m "Broadcast controls return ActionResult with the server's own message

A heat not on the floor, an athlete or sponsor out of scope, or a floor
whose controls this account can't drive now comes back as a result the
board can show, instead of a thrown error a production build hides.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: On-air helpers

**Files:**
- Create: `src/app/(app)/dashboard/[floorId]/onAir.ts`
- Test: `src/app/(app)/dashboard/[floorId]/onAir.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface OnAirHeat {
    id: string; heatNumber: number; heatCount: number | null;
    wod: { name: string }; division: { name: string };
    lanes: Array<{ athleteId: string | null; name: string | null }>;
  }
  export interface OnAirSummary {
    heatLabel: string | null; graphicLabel: string;
    lowerThirdName: string | null; sponsorName: string | null; timerStateLabel: string;
  }
  export function onAirSummary(
    state: Pick<BroadcastStateRow, "current_heat_id" | "active_graphic" | "lower_third_athlete_id" | "active_sponsor_id" | "timer_status"> | null,
    heats: OnAirHeat[],
    sponsors: Array<{ id: string; business_name: string }>,
  ): OnAirSummary;
  export function needsRestartConfirm(status: TimerStatus | undefined): boolean;
  export function needsHeatSwitchConfirm(status: TimerStatus | undefined): boolean;
  ```

- [ ] **Step 1: Write the failing test** `onAir.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { needsHeatSwitchConfirm, needsRestartConfirm, onAirSummary } from "./onAir";

const HEATS = [
  {
    id: "h-6",
    heatNumber: 6,
    heatCount: 9,
    wod: { name: "WOD 2" },
    division: { name: "Intermediate Female" },
    lanes: [{ athleteId: "a-1", name: "Maria Rivera" }],
  },
];
const SPONSORS = [{ id: "s-1", business_name: "Hoka" }];
const idle = {
  current_heat_id: null,
  active_graphic: "none" as const,
  lower_third_athlete_id: null,
  active_sponsor_id: null,
  timer_status: "idle" as const,
};

describe("onAirSummary", () => {
  it("says nothing is on air", () => {
    expect(onAirSummary(idle, HEATS, SPONSORS)).toEqual({
      heatLabel: null,
      graphicLabel: "None",
      lowerThirdName: null,
      sponsorName: null,
      timerStateLabel: "Idle",
    });
  });

  it("names everything on air", () => {
    expect(
      onAirSummary(
        {
          current_heat_id: "h-6",
          active_graphic: "lanes",
          lower_third_athlete_id: "a-1",
          active_sponsor_id: "s-1",
          timer_status: "running",
        },
        HEATS,
        SPONSORS,
      ),
    ).toEqual({
      heatLabel: "WOD 2 · Heat 6 / 9 · Intermediate Female",
      graphicLabel: "Lanes",
      lowerThirdName: "Maria Rivera",
      sponsorName: "Hoka",
      timerStateLabel: "Running",
    });
  });

  it("says 'On air' for ids it can't name", () => {
    const s = onAirSummary(
      { ...idle, lower_third_athlete_id: "gone", active_sponsor_id: "gone" },
      HEATS,
      SPONSORS,
    );
    expect(s.lowerThirdName).toBe("On air");
    expect(s.sponsorName).toBe("On air");
  });

  it("handles no state yet", () => {
    expect(onAirSummary(null, HEATS, SPONSORS).heatLabel).toBeNull();
  });
});

describe("confirmations", () => {
  it.each([
    ["idle", false],
    ["ended", false],
    ["running", true],
    ["paused", true],
    [undefined, false],
  ] as const)("timer %s asks before a restart or heat switch: %s", (status, asks) => {
    expect(needsRestartConfirm(status)).toBe(asks);
    expect(needsHeatSwitchConfirm(status)).toBe(asks);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.** Command: `pnpm vitest run "src/app/(app)/dashboard"`. Expected: FAIL, because the module is missing.

- [ ] **Step 3: Implement** `onAir.ts`

```ts
import type { ActiveGraphic, Database, TimerStatus } from "@/lib/db/database.types";

type BroadcastStateRow = Database["public"]["Tables"]["broadcast_state"]["Row"];

export interface OnAirHeat {
  id: string;
  heatNumber: number;
  heatCount: number | null;
  wod: { name: string };
  division: { name: string };
  lanes: Array<{ athleteId: string | null; name: string | null }>;
}

export interface OnAirSummary {
  heatLabel: string | null;
  graphicLabel: string;
  lowerThirdName: string | null;
  sponsorName: string | null;
  timerStateLabel: string;
}

export const GRAPHIC_LABEL: Record<ActiveGraphic, string> = {
  none: "None",
  heat_intro: "Heat intro",
  lanes: "Lanes",
  wod: "WOD",
  timer: "Timer",
  score: "Score",
  leaderboard: "Leaderboard",
  lower_third: "Lower third",
  sponsor: "Sponsor",
};

const TIMER_STATE_LABEL: Record<TimerStatus, string> = {
  idle: "Idle",
  running: "Running",
  paused: "Paused",
  ended: "Ended",
};

/** "WOD 2 · Heat 6 / 9" — the heat's name on the board and in its confirmations. */
export function heatName(h: Pick<OnAirHeat, "heatNumber" | "heatCount" | "wod">): string {
  return `${h.wod.name} · Heat ${h.heatNumber}${h.heatCount ? ` / ${h.heatCount}` : ""}`;
}

/**
 * What the audience sees right now, in words, for the On air bar. An id that
 * no longer resolves (athlete unlaned, sponsor deactivated) is still on air,
 * so it reads "On air" rather than "None".
 */
export function onAirSummary(
  state: Pick<
    BroadcastStateRow,
    | "current_heat_id"
    | "active_graphic"
    | "lower_third_athlete_id"
    | "active_sponsor_id"
    | "timer_status"
  > | null,
  heats: OnAirHeat[],
  sponsors: Array<{ id: string; business_name: string }>,
): OnAirSummary {
  const heat = heats.find((h) => h.id === state?.current_heat_id) ?? null;
  const athleteId = state?.lower_third_athlete_id ?? null;
  const sponsorId = state?.active_sponsor_id ?? null;
  return {
    heatLabel: heat ? `${heatName(heat)} · ${heat.division.name}` : null,
    graphicLabel: GRAPHIC_LABEL[state?.active_graphic ?? "none"],
    lowerThirdName: athleteId
      ? (heats.flatMap((h) => h.lanes).find((l) => l.athleteId === athleteId)?.name ?? "On air")
      : null,
    sponsorName: sponsorId
      ? (sponsors.find((s) => s.id === sponsorId)?.business_name ?? "On air")
      : null,
    timerStateLabel: TIMER_STATE_LABEL[state?.timer_status ?? "idle"],
  };
}

/** A clock that is running or paused would be thrown away by Start. */
export function needsRestartConfirm(status: TimerStatus | undefined): boolean {
  return status === "running" || status === "paused";
}

/** Switching heats while the clock runs leaves it timing the old heat. */
export function needsHeatSwitchConfirm(status: TimerStatus | undefined): boolean {
  return status === "running" || status === "paused";
}
```

- [ ] **Step 4: Run it and confirm it passes.** Command: `pnpm vitest run "src/app/(app)/dashboard"`. Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/dashboard/[floorId]/onAir.ts" "src/app/(app)/dashboard/[floorId]/onAir.test.ts"
pnpm check && git commit -m "The board can say in words what is on air and when to ask first

One helper names the heat, graphic, lower third, sponsor and timer state
for the On air bar; two more say when Start and a heat switch need a
confirmation (the timer is running or paused).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `OnAirBar` and the board-sized timer

**Files:**
- Create: `src/app/(app)/dashboard/[floorId]/OnAirBar.tsx`
- Modify: `src/components/graphics/TimerDisplay.tsx` (add `size`)
- Test: `src/app/(app)/dashboard/[floorId]/OnAirBar.test.tsx`

**Interfaces:**
- Consumes: Task 2's `OnAirSummary`.
- Produces:
  ```ts
  export function OnAirBar(props: {
    connected: boolean; pending: boolean; summary: OnAirSummary; timerSeconds: number;
    offAirHeatNumber: number | null;  // set when no heat is on air
    onPutOnAir: () => void;
    onClear: () => Promise<unknown>;  // ConfirmAction's onConfirm
  }): JSX.Element;
  ```
  `TimerDisplay` gains `size?: "default" | "board"`.

- [ ] **Step 1: Write the failing test** `OnAirBar.test.tsx`

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  unstable_rethrow: () => {},
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { OnAirBar } from "./OnAirBar";

const nothing = {
  heatLabel: null,
  graphicLabel: "None",
  lowerThirdName: null,
  sponsorName: null,
  timerStateLabel: "Idle",
};

afterEach(cleanup);

describe("OnAirBar", () => {
  it("says no heat is on air and offers to put one on", async () => {
    const onPutOnAir = vi.fn();
    render(
      <OnAirBar
        connected
        pending={false}
        summary={nothing}
        timerSeconds={0}
        offAirHeatNumber={1}
        onPutOnAir={onPutOnAir}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByText("No heat on air")).toBeTruthy();
    await userEvent.setup().click(screen.getByRole("button", { name: "Put Heat 1 on air" }));
    expect(onPutOnAir).toHaveBeenCalled();
  });

  it("names what the audience sees", () => {
    render(
      <OnAirBar
        connected
        pending={false}
        summary={{
          heatLabel: "WOD 2 · Heat 6 / 9 · Intermediate Female",
          graphicLabel: "Lanes",
          lowerThirdName: "Maria Rivera",
          sponsorName: "Hoka",
          timerStateLabel: "Running",
        }}
        timerSeconds={462}
        offAirHeatNumber={null}
        onPutOnAir={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    const bar = screen.getByRole("region", { name: "On air" });
    expect(bar.textContent).toContain("WOD 2 · Heat 6 / 9 · Intermediate Female");
    expect(bar.textContent).toContain("07:42");
    expect(bar.textContent).toContain("Running");
    expect(bar.textContent).toContain("Lanes");
    expect(bar.textContent).toContain("Maria Rivera");
    expect(bar.textContent).toContain("Hoka");
    expect(screen.queryByRole("button", { name: /on air/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Clear all" })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.** Command: `pnpm vitest run "src/app/(app)/dashboard"`. Expected: FAIL, because `./OnAirBar` is missing.

- [ ] **Step 3: Add `size` to `TimerDisplay`.** Add the prop `size = "default"` typed `size?: "default" | "board"`. The non-fullscreen wrapper class becomes `` `inline-flex items-center justify-center bg-broadcast-bg shadow-2xl ${size === "board" ? "px-6 py-3" : "px-10 py-6"}` ``. The non-fullscreen text size becomes `size === "board" ? "text-5xl" : "text-7xl"`. Fullscreen is unchanged.

- [ ] **Step 4: Implement** `OnAirBar.tsx`

```tsx
"use client";

import { Timer } from "lucide-react";
import { formatClock } from "@/lib/timer/compute";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OnAirSummary } from "./onAir";

/** A label that shortens on a phone; the full word stays for screen readers. */
function Term({ short, full }: { short: string; full: string }) {
  return (
    <dt className="text-muted-foreground">
      <span aria-hidden className="sm:hidden">
        {short}
      </span>
      <span className="max-sm:sr-only">{full}</span>:
    </dt>
  );
}

/**
 * What the audience sees right now, pinned above the board: the heat, the
 * clock, the graphic, the lower third and the sponsor. With no heat on air it
 * says so and offers to put one on, since every overlay is blank until then.
 */
export function OnAirBar({
  connected,
  pending,
  summary,
  timerSeconds,
  offAirHeatNumber,
  onPutOnAir,
  onClear,
}: {
  connected: boolean;
  pending: boolean;
  summary: OnAirSummary;
  timerSeconds: number;
  offAirHeatNumber: number | null;
  onPutOnAir: () => void;
  onClear: () => Promise<unknown>;
}) {
  return (
    <section
      aria-label="On air"
      className="top-[calc(3.5rem+env(safe-area-inset-top))] z-10 border-b border-border bg-card/95 px-4 py-2 backdrop-blur [@media(min-height:600px)]:sticky"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <span
            role="status"
            aria-live="polite"
            className={cn(
              "flex items-center gap-2 text-xs font-semibold tracking-wide uppercase",
              connected ? "text-success-text" : "text-brand-text",
            )}
          >
            <span
              aria-hidden
              className={cn("size-3 rounded-full", connected ? "bg-success" : "animate-pulse bg-primary")}
            />
            {connected ? "Live" : "Reconnecting…"}
          </span>
          {summary.heatLabel ? (
            <span className="font-display text-lg font-bold tracking-wide uppercase">
              {summary.heatLabel}
            </span>
          ) : (
            <span className="font-semibold text-warning-text">No heat on air</span>
          )}
          <span className="flex items-center gap-2">
            <Timer aria-hidden className="size-4 text-muted-foreground" />
            <span className="font-display text-lg tabular-nums">{formatClock(timerSeconds)}</span>
            <span className="text-xs tracking-wide text-muted-foreground uppercase">
              {summary.timerStateLabel}
            </span>
          </span>
          <span role="status" aria-live="polite" className="text-xs text-muted-foreground">
            {pending ? "Sending…" : ""}
          </span>
          {offAirHeatNumber !== null ? (
            <Button size="touch" className="ml-auto min-h-11" onClick={onPutOnAir}>
              Put Heat {offAirHeatNumber} on air
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <dl className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <div className="flex gap-1.5">
              <Term short="GFX" full="Graphic" />
              <dd className="font-semibold">{summary.graphicLabel}</dd>
            </div>
            <div className="flex gap-1.5">
              <Term short="L3" full="Lower third" />
              <dd className="font-semibold">{summary.lowerThirdName ?? "None"}</dd>
            </div>
            <div className="flex gap-1.5">
              <Term short="Sponsor" full="Sponsor" />
              <dd className="font-semibold">{summary.sponsorName ?? "None"}</dd>
            </div>
          </dl>
          <span className="ml-auto">
            <ConfirmAction
              trigger="Clear all"
              title="Clear all graphics from air?"
              description="The graphic, the lower third and the sponsor all come off the program output."
              confirmLabel="Clear graphics"
              variant="default"
              triggerVariant="outline"
              triggerSize="default"
              triggerClassName="min-h-11"
              onConfirm={onClear}
            />
          </span>
        </div>
      </div>
    </section>
  );
}
```

`role="region"` comes implicitly from `<section aria-label>`, so the test's `getByRole("region", { name: "On air" })` finds it.

- [ ] **Step 5: Run it and confirm it passes.** Command: `pnpm vitest run "src/app/(app)/dashboard" src/components`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/dashboard/[floorId]/OnAirBar.tsx" "src/app/(app)/dashboard/[floorId]/OnAirBar.test.tsx" src/components/graphics/TimerDisplay.tsx
pnpm check && git commit -m "An On air bar names what the audience sees

The heat, the clock and its state, the graphic, the lower third and the
sponsor in two lines, with Clear all and, when nothing is on air, Put
Heat N on air. The timer display gets a board size.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The two-column board with confirmations

**Files:**
- Rewrite: `src/app/(app)/dashboard/[floorId]/DashboardClient.tsx`
- Test: `src/app/(app)/dashboard/[floorId]/DashboardClient.test.tsx`

**Interfaces:**
- Consumes:
  - Task 1's actions;
  - Task 2's `onAirSummary`, `needsRestartConfirm`, `needsHeatSwitchConfirm`, `GRAPHIC_LABEL` and `heatName`;
  - Task 3's `OnAirBar` and `TimerDisplay size="board"`;
  - `ToggleGroup`.
- Produces: `DashboardClient`, with the same exported props and `DashboardHeat` as today.

- [ ] **Step 1: Write the failing test** `DashboardClient.test.tsx`

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  unstable_rethrow: () => {},
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/realtime/useBroadcastState", () => ({
  useBroadcastState: (_floorId: string, initial: unknown) => ({ state: initial, connected: true }),
}));
vi.mock("@/lib/realtime/useRefreshOnChanges", () => ({ useRefreshOnChanges: () => {} }));
vi.mock("@/lib/realtime/floorWatches", () => ({ floorWatches: () => [] }));
vi.mock("@/lib/realtime/useLiveTimer", () => ({
  useLiveTimer: () => ({ displaySeconds: 462, atLimit: false }),
}));
const actions = vi.hoisted(() => ({
  setCurrentHeat: vi.fn(async () => ({ ok: true })),
  setActiveGraphic: vi.fn(async () => ({ ok: true })),
  setLowerThird: vi.fn(async () => ({ ok: true })),
  setActiveSponsor: vi.fn(async () => ({ ok: true })),
  clearGraphics: vi.fn(async () => ({ ok: true })),
  startTimer: vi.fn(async () => ({ ok: true })),
  pauseTimer: vi.fn(async () => ({ ok: true })),
  resumeTimer: vi.fn(async () => ({ ok: true })),
  resetTimer: vi.fn(async () => ({ ok: true })),
  adjustTimer: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/actions/broadcast", () => actions);

import { DashboardClient, type DashboardHeat } from "./DashboardClient";

const heat = (n: number): DashboardHeat => ({
  id: `h-${n}`,
  heatNumber: n,
  heatCount: 2,
  wod: { id: "w", name: "WOD 2", scoring_type: "for_time", time_cap_seconds: 600 },
  division: { id: "d", name: "Intermediate Female" },
  lanes: [{ laneNumber: 1, athleteId: `a-${n}`, name: `Athlete ${n}`, affiliate: null }],
});
const HEATS = [heat(1), heat(2)];

function state(timer_status: "idle" | "running" | "paused" | "ended", current_heat_id = "h-1") {
  return {
    floor_id: "f",
    current_heat_id,
    active_graphic: "none",
    lower_third_athlete_id: null,
    active_sponsor_id: null,
    timer_status,
    timer_direction: "count_down",
    timer_duration_seconds: 600,
    timer_elapsed_at_anchor: 0,
    timer_anchor_time: null,
    updated_at: "",
  } as never;
}

function setup(s: ReturnType<typeof state>) {
  render(
    <DashboardClient
      floorId="f"
      eventId="ev"
      eventName="Aprieta"
      heats={HEATS}
      initialBroadcastState={s}
      sponsors={[]}
    />,
  );
  return userEvent.setup();
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DashboardClient", () => {
  it("switches heats at once when the timer is idle", async () => {
    const user = setup(state("idle"));
    await user.click(screen.getByRole("button", { name: /Next heat/ }));
    await waitFor(() => expect(actions.setCurrentHeat).toHaveBeenCalledWith("f", "h-2"));
  });

  it("asks before switching heats while the timer runs", async () => {
    const user = setup(state("running"));
    await user.click(screen.getByRole("button", { name: /Next heat/ }));
    expect(actions.setCurrentHeat).not.toHaveBeenCalled();
    expect(screen.getByText("Switch to Heat 2?")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Switch heat" }));
    await waitFor(() => expect(actions.setCurrentHeat).toHaveBeenCalledWith("f", "h-2"));
  });

  it("asks before restarting a running timer", async () => {
    const user = setup(state("running"));
    await user.click(screen.getByRole("button", { name: "Start" }));
    expect(actions.startTimer).not.toHaveBeenCalled();
    expect(screen.getByText("Restart the timer?")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Restart timer" }));
    await waitFor(() => expect(actions.startTimer).toHaveBeenCalled());
  });

  it("starts an idle timer at once", async () => {
    const user = setup(state("idle"));
    await user.click(screen.getByRole("button", { name: "Start" }));
    await waitFor(() =>
      expect(actions.startTimer).toHaveBeenCalledWith("f", "count_down", 600),
    );
  });

  it("puts the first heat on air without asking", async () => {
    const user = setup(state("running", null as never));
    expect(screen.getByText("No heat on air")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Put Heat 1 on air" }));
    await waitFor(() => expect(actions.setCurrentHeat).toHaveBeenCalledWith("f", "h-1"));
  });

  it("shows the server's message when a control fails", async () => {
    actions.setActiveGraphic.mockResolvedValueOnce({
      ok: false,
      message: "This floor's broadcast controls aren't available to your account.",
    } as never);
    const user = setup(state("idle"));
    await user.click(screen.getByRole("button", { name: "Show Lanes" }));
    expect(
      await screen.findByText("This floor's broadcast controls aren't available to your account."),
    ).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.** Command: `pnpm vitest run "src/app/(app)/dashboard"`. Expected: FAIL. The current board switches heats without asking, has no "No heat on air" bar text, and so on.

- [ ] **Step 3: Rewrite `DashboardClient.tsx`**

```tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, ListOrdered } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { useBroadcastState } from "@/lib/realtime/useBroadcastState";
import { useLiveTimer } from "@/lib/realtime/useLiveTimer";
import { floorWatches } from "@/lib/realtime/floorWatches";
import { useRefreshOnChanges } from "@/lib/realtime/useRefreshOnChanges";
import { formatClock } from "@/lib/timer/compute";
import type { ActionResult } from "@/lib/action-result";
import { TimerDisplay } from "@/components/graphics/TimerDisplay";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  adjustTimer,
  clearGraphics,
  pauseTimer,
  resetTimer,
  resumeTimer,
  setActiveGraphic,
  setActiveSponsor,
  setCurrentHeat,
  setLowerThird,
  startTimer,
} from "@/lib/actions/broadcast";
import type { ActiveGraphic, Database } from "@/lib/db/database.types";
import { heatOnAir } from "@/lib/broadcast/heatOnAir";
import { OnAirBar } from "./OnAirBar";
import {
  GRAPHIC_LABEL,
  heatName,
  needsHeatSwitchConfirm,
  needsRestartConfirm,
  onAirSummary,
} from "./onAir";

export interface DashboardHeat {
  id: string;
  heatNumber: number;
  heatCount: number | null;
  wod: { id: string; name: string; scoring_type: string; time_cap_seconds: number | null };
  division: { id: string; name: string };
  lanes: Array<{
    laneNumber: number;
    athleteId: string | null;
    name: string | null;
    affiliate: string | null;
  }>;
}

type BroadcastStateRow = Database["public"]["Tables"]["broadcast_state"]["Row"];

const GRAPHICS: ActiveGraphic[] = ["heat_intro", "lanes", "wod", "timer", "score", "leaderboard"];

/** Live controls: 56px — big enough to hit mid-broadcast, small enough that the board fits a tablet. */
const LIVE = "min-h-14";

/**
 * A thrown error (network, server crash) has no message a production build
 * shows, so it names what failed; the detail is added in development.
 */
function failureMessage(what: string, e: unknown): string {
  const detail =
    process.env.NODE_ENV === "development" && e instanceof Error ? ` (${e.message})` : "";
  return `Couldn't ${what}. Check the connection and try again.${detail}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const id = `section-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <Card size="sm" role="region" aria-labelledby={id}>
      <CardHeader>
        <CardTitle>
          <h2
            id={id}
            className="text-xs font-semibold tracking-widest text-muted-foreground uppercase"
          >
            {title}
          </h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </Card>
  );
}

/**
 * The producer's live board for one floor. The On air bar says what the
 * audience sees; below it, "the floor" (heat and timer) on the left and "the
 * audience" (graphics, lower third, sponsors) on the right from lg. Only what
 * would hurt on air asks first: restarting a running clock, switching heats
 * while it runs, Reset and Clear all.
 */
export function DashboardClient({
  floorId,
  eventName,
  heats,
  initialBroadcastState,
  sponsors,
}: {
  floorId: string;
  eventId: string;
  eventName: string;
  heats: DashboardHeat[];
  initialBroadcastState: BroadcastStateRow | null;
  sponsors: Array<{ id: string; business_name: string; tier: string }>;
}) {
  const { state, connected } = useBroadcastState(floorId, initialBroadcastState);
  useRefreshOnChanges(
    floorWatches(
      floorId,
      heats.map((h) => h.id),
    ),
  );
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<string | null>(null);
  const [countDirection, setCountDirection] = useState<"count_up" | "count_down">("count_down");
  const [lowerThirdAthlete, setLowerThirdAthlete] = useState<string>("");
  const [switchTo, setSwitchTo] = useState<number | null>(null);

  // With nothing on air yet, the first heat is shown with a "put on air"
  // control; see lib/broadcast/heatOnAir.ts.
  const { index, onAir } = useMemo(
    () => heatOnAir(heats, state?.current_heat_id ?? null),
    [heats, state?.current_heat_id],
  );
  const currentHeat = heats[index] ?? null;
  const summary = useMemo(() => onAirSummary(state, heats, sponsors), [state, heats, sponsors]);

  const timer = useLiveTimer({
    status: state?.timer_status ?? "idle",
    direction: state?.timer_direction ?? "count_down",
    durationSeconds: state?.timer_duration_seconds ?? 0,
    elapsedAtAnchor: state?.timer_elapsed_at_anchor ?? 0,
    anchorTimeMs: state?.timer_anchor_time ? new Date(state.timer_anchor_time).getTime() : null,
  });

  // Every one-tap control goes through here: "Sending…" shows while it runs,
  // and a failure — the server's own words, or a named one for a crash — stays
  // on screen until dismissed instead of vanishing mid-broadcast.
  function go(what: string, action: () => Promise<ActionResult>) {
    setFailure(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) setFailure(result.message);
      } catch (e) {
        unstable_rethrow(e);
        setFailure(failureMessage(what, e));
      }
    });
  }

  function putOnAir(i: number) {
    const heat = heats[i];
    if (heat) go(`switch to heat ${heat.heatNumber}`, () => setCurrentHeat(floorId, heat.id));
  }

  function requestHeat(i: number) {
    if (!heats[i]) return;
    if (needsHeatSwitchConfirm(state?.timer_status)) setSwitchTo(i);
    else putOnAir(i);
  }

  if (!currentHeat) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <EmptyState
          icon={ListOrdered}
          title="No heats scheduled on this floor yet"
          description="Set them up in Admin → Heats & Lanes."
        />
      </div>
    );
  }

  const status = state?.timer_status ?? "idle";
  const paused = status === "paused";
  const athletesInHeat = currentHeat.lanes.filter((l) => l.athleteId);
  const duration =
    countDirection === "count_down"
      ? (currentHeat.wod.time_cap_seconds ?? 600)
      : (currentHeat.wod.time_cap_seconds ?? 0);
  const start = () => startTimer(floorId, countDirection, duration);
  const target = switchTo !== null ? heats[switchTo] : null;

  return (
    <div className="flex flex-col">
      <OnAirBar
        connected={connected}
        pending={pending}
        summary={summary}
        timerSeconds={timer.displaySeconds}
        offAirHeatNumber={onAir ? null : currentHeat.heatNumber}
        onPutOnAir={() => putOnAir(index)}
        onClear={() => clearGraphics(floorId)}
      />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4">
        <h1 className="sr-only">Production — {eventName}</h1>

        {failure && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-xl border border-destructive/50 bg-destructive/10 px-5 py-2 text-sm"
          >
            <span>{failure}</span>
            <Button variant="ghost" className="min-h-11 shrink-0" onClick={() => setFailure(null)}>
              Dismiss
            </Button>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* The floor */}
          <div className="flex flex-col gap-4">
            <Section title="Heat">
              <div>
                <p className="font-display text-xl font-bold tracking-wide uppercase">
                  {heatName(currentHeat)}
                </p>
                <p className="text-sm font-semibold tracking-wide text-brand-text uppercase">
                  {currentHeat.division.name}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  size="touch"
                  variant="secondary"
                  className={cn(LIVE, "gap-2")}
                  disabled={index <= 0}
                  onClick={() => requestHeat(index - 1)}
                >
                  <ChevronLeft aria-hidden />
                  Previous heat
                </Button>
                <Button
                  size="touch"
                  variant="secondary"
                  className={cn(LIVE, "gap-2")}
                  disabled={index >= heats.length - 1}
                  onClick={() => requestHeat(index + 1)}
                >
                  Next heat
                  <ChevronRight aria-hidden />
                </Button>
              </div>
              <ul aria-label="Lanes" className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {currentHeat.lanes.map((lane) => (
                  <li
                    key={lane.laneNumber}
                    className="flex min-w-0 items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">
                      {lane.laneNumber}
                    </span>
                    <span className="truncate font-semibold">{lane.name ?? "—"}</span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Timer">
              <div className="flex justify-center">
                <TimerDisplay seconds={timer.displaySeconds} atLimit={timer.atLimit} size="board" />
              </div>
              <ToggleGroup
                type="single"
                variant="outline"
                size="touch"
                value={countDirection}
                onValueChange={(v) => v && setCountDirection(v as "count_up" | "count_down")}
                aria-label="Timer direction"
                className="w-full"
              >
                <ToggleGroupItem
                  value="count_down"
                  className="flex-1 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  Count down
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="count_up"
                  className="flex-1 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  Count up
                </ToggleGroupItem>
              </ToggleGroup>
              <div className="grid grid-cols-3 gap-3">
                {needsRestartConfirm(status) ? (
                  <ConfirmAction
                    trigger="Start"
                    title="Restart the timer?"
                    description={`The clock is at ${formatClock(timer.displaySeconds)}. Restarting sets it back to the start, on the board and on air.`}
                    confirmLabel="Restart timer"
                    variant="default"
                    triggerVariant="default"
                    triggerSize="touch"
                    triggerClassName={LIVE}
                    onConfirm={start}
                  />
                ) : (
                  <Button size="touch" className={LIVE} onClick={() => go("start the timer", start)}>
                    Start
                  </Button>
                )}
                <Button
                  size="touch"
                  variant="secondary"
                  className={LIVE}
                  onClick={() =>
                    go(paused ? "resume the timer" : "pause the timer", () =>
                      paused ? resumeTimer(floorId) : pauseTimer(floorId),
                    )
                  }
                >
                  {paused ? "Resume" : "Pause"}
                </Button>
                <ConfirmAction
                  trigger="Reset"
                  title="Reset the timer?"
                  description="The clock goes back to zero and stops, on the dashboard and on air."
                  confirmLabel="Reset timer"
                  variant="default"
                  triggerVariant="secondary"
                  triggerSize="touch"
                  triggerClassName={LIVE}
                  onConfirm={() => resetTimer(floorId)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  size="touch"
                  variant="secondary"
                  className={LIVE}
                  onClick={() => go("adjust the timer", () => adjustTimer(floorId, -10))}
                >
                  −10s
                </Button>
                <Button
                  size="touch"
                  variant="secondary"
                  className={LIVE}
                  onClick={() => go("adjust the timer", () => adjustTimer(floorId, 10))}
                >
                  +10s
                </Button>
              </div>
            </Section>
          </div>

          {/* The audience */}
          <div className="flex flex-col gap-4">
            <Section title="Graphics">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {GRAPHICS.map((g) => {
                  const pressed = state?.active_graphic === g;
                  return (
                    <Button
                      key={g}
                      size="touch"
                      variant={pressed ? "default" : "secondary"}
                      aria-pressed={pressed}
                      className={cn(LIVE, "h-auto px-3 whitespace-normal")}
                      onClick={() =>
                        go(`show ${GRAPHIC_LABEL[g].toLowerCase()}`, () =>
                          setActiveGraphic(floorId, g),
                        )
                      }
                    >
                      Show {GRAPHIC_LABEL[g]}
                    </Button>
                  );
                })}
              </div>
            </Section>

            <Section title="Lower third">
              <div className="flex flex-wrap items-end gap-3">
                <div className="grid min-w-48 flex-1 gap-2">
                  <Label htmlFor="lower-third-athlete">Lower third athlete</Label>
                  <Select value={lowerThirdAthlete} onValueChange={setLowerThirdAthlete}>
                    <SelectTrigger
                      id="lower-third-athlete"
                      className="w-full data-[size=default]:h-12"
                    >
                      <SelectValue placeholder="Select athlete…" />
                    </SelectTrigger>
                    <SelectContent>
                      {athletesInHeat.map((l) => (
                        <SelectItem key={l.laneNumber} value={l.athleteId!}>
                          Lane {l.laneNumber} — {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="touch"
                  className={LIVE}
                  disabled={!lowerThirdAthlete}
                  onClick={() =>
                    go("show the lower third", () => setLowerThird(floorId, lowerThirdAthlete))
                  }
                >
                  Show
                </Button>
                <Button
                  size="touch"
                  variant="secondary"
                  className={LIVE}
                  onClick={() => go("hide the lower third", () => setLowerThird(floorId, null))}
                >
                  Hide
                </Button>
              </div>
            </Section>

            <Section title="Sponsors">
              {sponsors.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {sponsors.map((s) => {
                    const pressed = state?.active_sponsor_id === s.id;
                    return (
                      <Button
                        key={s.id}
                        size="touch"
                        variant={pressed ? "default" : "secondary"}
                        aria-pressed={pressed}
                        className={cn(LIVE, "h-auto px-3 whitespace-normal")}
                        onClick={() =>
                          go(`toggle ${s.business_name}`, () =>
                            setActiveSponsor(floorId, pressed ? null : s.id),
                          )
                        }
                      >
                        {s.business_name}
                      </Button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No active sponsors for this event.</p>
              )}
            </Section>
          </div>
        </div>
      </div>

      <ConfirmAction
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setSwitchTo(null);
        }}
        title={target ? `Switch to Heat ${target.heatNumber}?` : ""}
        description={`The timer is ${paused ? "paused" : "running"} for Heat ${currentHeat.heatNumber}. Switching heats doesn't stop it.`}
        confirmLabel="Switch heat"
        variant="default"
        onConfirm={async () => (target ? setCurrentHeat(floorId, target.id) : undefined)}
      />
    </div>
  );
}
```

**Notes for the implementer:**
- `eventId` stays in the props type, because both pages pass it, but it isn't destructured. Lint may flag an unused prop type; that's fine. If ESLint flags it, destructure it as `eventId: _eventId`.
- The "Put Heat N on air" button lives in `OnAirBar` and never asks (Review Focus 4).
- If `ConfirmAction` with `trigger` and `triggerVariant="default"` renders the trigger as a `button` whose accessible name is "Start", the test's `getByRole("button", { name: "Start" })` finds it. Check that "Restart timer" doesn't also match `name: "Start"`. It won't, because the name match is exact.

- [ ] **Step 4: Run it and confirm it passes.** Command: `pnpm vitest run "src/app/(app)/dashboard"`. Expected: PASS. If a jsdom test fails on `ResizeObserver` (Radix Toggle or Select), add the same stub `ScoreDrawer.test.tsx` uses. If it fails on `matchMedia`, add the `FormDialog.test.tsx` stub.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/dashboard/[floorId]/DashboardClient.tsx" "src/app/(app)/dashboard/[floorId]/DashboardClient.test.tsx"
pnpm check && git commit -m "The production board is two columns under an On air bar

Heat and timer on the left, graphics, lower third and sponsors on the
right from 1024px, so a tablet reaches every control without scrolling.
Restarting a running clock and switching heats while it runs now ask
first; a failed control shows the server's own message.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Producer tabs: Broadcast removed, Scores as a DataTable, the other lists as tables

**Files:**
- Modify: `src/app/(app)/producer/events/[eventId]/layout.tsx` (remove the Broadcast tab)
- Rewrite: `src/app/(app)/producer/events/[eventId]/broadcast/page.tsx` (redirect)
- Create: `src/app/(app)/producer/events/[eventId]/scores/ScoresTable.tsx`
- Test: `src/app/(app)/producer/events/[eventId]/scores/ScoresTable.test.tsx`
- Modify: `src/app/(app)/producer/events/[eventId]/scores/page.tsx`
- Rewrite: `src/components/EventHeatsList.tsx`
- Modify: `src/app/(app)/producer/events/[eventId]/sponsors/page.tsx` and `commentary/page.tsx`

**Interfaces:**
- Consumes: `scoreSummary`, `LaneResult` and `ScoringType` from `@/lib/scoring/format`; `DataTable`, `dataTableColumns` and `RowActions`.
- Produces:
  ```ts
  export type ScoreRow = {
    id: string; competitor: string; wodName: string; heatNumber: number;
    divisionName: string; score: string; status: string; adjusted: boolean; floorId: string;
  };
  export function ScoresTable(props: { rows: ScoreRow[]; wods: string[]; divisions: string[] }): JSX.Element;
  ```

- [ ] **Step 1: Write the failing test** `ScoresTable.test.tsx`

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.stubGlobal("matchMedia", (q: string) => ({
  matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
}));

import { type ScoreRow, ScoresTable } from "./ScoresTable";

const ROWS: ScoreRow[] = [
  {
    id: "r-1", competitor: "Maria Rivera", wodName: "WOD 2", heatNumber: 6,
    divisionName: "Intermediate Female", score: "03:45", status: "completed",
    adjusted: false, floorId: "f-1",
  },
  {
    id: "r-2", competitor: "Camila Ortiz", wodName: "WOD 2", heatNumber: 6,
    divisionName: "Intermediate Female", score: "DNF", status: "dnf",
    adjusted: true, floorId: "f-1",
  },
];

afterEach(cleanup);

describe("ScoresTable", () => {
  it("shows each result's score, status and adjustment", () => {
    render(<ScoresTable rows={ROWS} wods={["WOD 2"]} divisions={["Intermediate Female"]} />);
    expect(screen.getByText("03:45")).toBeTruthy();
    expect(screen.getAllByText("DNF").length).toBeGreaterThan(0);
    expect(screen.getByText("Adjusted")).toBeTruthy();
    expect(screen.getAllByText("Heat 6").length).toBe(2);
  });

  it("searches by competitor", async () => {
    render(<ScoresTable rows={ROWS} wods={["WOD 2"]} divisions={["Intermediate Female"]} />);
    await userEvent.setup().type(screen.getByRole("searchbox", { name: "Search scores" }), "camila");
    expect(screen.queryByText("Maria Rivera")).toBeNull();
    expect(screen.getByText("Camila Ortiz")).toBeTruthy();
  });
});
```

Check the search input's role and name in `TableToolbar.tsx` first. If it's a `textbox` labelled by `search.label`, change `searchbox` to `textbox` in the test.

- [ ] **Step 2: Run it and confirm it fails.** Command: `pnpm vitest run "src/app/(app)/producer"`. Expected: FAIL, because the module is missing.

- [ ] **Step 3: Implement** `ScoresTable.tsx`

```tsx
"use client";

import { ClipboardList, PencilLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { dataTableColumns } from "@/lib/data-table";
import { DataTable } from "@/components/app/data-table/DataTable";
import { EmptyState } from "@/components/app/EmptyState";
import { RowActions } from "@/components/app/RowActions";
import { Badge } from "@/components/ui/badge";

export type ScoreRow = {
  id: string;
  competitor: string;
  wodName: string;
  heatNumber: number;
  divisionName: string;
  /** The result in one line, from scoreSummary: "03:45", "CAP 87", "DNF". */
  score: string;
  status: string;
  adjusted: boolean;
  floorId: string;
};

const STATUS_STYLE: Record<string, string> = {
  completed: "border-success/40 bg-success/10 text-success-text",
};
const OTHER_STATUS = "border-warning/40 bg-warning/10 text-warning-text";

function CorrectAction({ r }: { r: ScoreRow }) {
  const router = useRouter();
  return (
    <RowActions
      label={`Actions for ${r.competitor}'s result`}
      secondary={[
        {
          label: "Correct on Score Keeper",
          icon: PencilLine,
          onSelect: () => router.push(`/scorekeeper/${r.floorId}`),
        },
      ]}
    />
  );
}

const col = dataTableColumns<ScoreRow>();
const columns = [
  col.accessor("competitor", {
    header: "Competitor",
    cell: ({ getValue }) => <span className="font-semibold">{getValue()}</span>,
  }),
  col.accessor("wodName", {
    header: "WOD",
    filterFn: "equals",
    meta: { priority: "low" },
  }),
  col.accessor("heatNumber", {
    header: "Heat",
    cell: ({ getValue }) => <span className="tabular-nums">Heat {getValue()}</span>,
  }),
  col.accessor("divisionName", {
    header: "Division",
    enableSorting: false,
    filterFn: "equals",
    meta: { priority: "low" },
  }),
  col.accessor("score", {
    header: "Score",
    enableSorting: false,
    cell: ({ getValue }) => <span className="font-display text-base tabular-nums">{getValue()}</span>,
  }),
  col.accessor("status", {
    header: "Status",
    filterFn: "equals",
    cell: ({ row }) => (
      <span className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className={`uppercase ${STATUS_STYLE[row.original.status] ?? OTHER_STATUS}`}>
          {row.original.status}
        </Badge>
        {row.original.adjusted ? <Badge variant="secondary">Adjusted</Badge> : null}
      </span>
    ),
  }),
  col.display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    meta: { rowActions: true },
    cell: ({ row }) => <CorrectAction r={row.original} />,
  }),
];

export function ScoresTable({
  rows,
  wods,
  divisions,
}: {
  rows: ScoreRow[];
  wods: string[];
  divisions: string[];
}) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      search={{ label: "Search scores", placeholder: "Search by athlete or team…" }}
      initialSorting={[
        { id: "wodName", desc: false },
        { id: "heatNumber", desc: false },
      ]}
      filters={[
        {
          columnId: "status",
          label: "Status",
          allLabel: "All statuses",
          options: [
            ["completed", "Completed"],
            ["dnf", "DNF"],
            ["dns", "DNS"],
            ["dq", "DQ"],
          ],
        },
        {
          columnId: "wodName",
          label: "WOD",
          allLabel: "All WODs",
          options: wods.map((w) => [w, w] as const),
        },
        {
          columnId: "divisionName",
          label: "Division",
          allLabel: "All divisions",
          options: divisions.map((d) => [d, d] as const),
        },
      ]}
      empty={<EmptyState icon={ClipboardList} title="No scores recorded for this event yet" />}
    />
  );
}
```

Check the `RowActions` props against `src/components/app/RowActions.tsx` (and how `PaymentsTable` calls it): `label`, `primary?`, `secondary?`, `destructive?`. Each item takes `label`, `onSelect`, optional `icon` and `ariaLabel`. If `icon` isn't a field on secondary items, drop it.

- [ ] **Step 4: Wire `scores/page.tsx`.**
  - Add `scoring_type` to the heats select: `"id, floor_id, heat_number, wods(name, scoring_type), divisions(name)"`.
  - Add the score columns to the results select: `"id, heat_id, athlete_id, status, manually_adjusted, time_seconds, reps, load, points, capped, tiebreak_value, athletes(first_name, last_name), teams(name)"`.
  - Widen `HeatRow.wods` to `{ name: string; scoring_type: string } | null`, and add those result fields to `ResultRow`.
  - Replace the JSX from `{resultRows.length > 0 ? (` to the matching `)}` with:
    ```tsx
    <ScoresTable rows={scoreRows} wods={wodNames} divisions={divisionNames} />
    ```
  - Build the rows above the `return`:
    ```ts
    const scoreRows: ScoreRow[] = resultRows.map((r) => {
      const heat = heatById.get(r.heat_id);
      return {
        id: r.id,
        competitor: r.athletes ? `${r.athletes.first_name} ${r.athletes.last_name}` : (r.teams?.name ?? "—"),
        wodName: heat?.wods?.name ?? "—",
        heatNumber: heat?.heat_number ?? 0,
        divisionName: heat?.divisions?.name ?? "—",
        score: scoreSummary(r as unknown as LaneResult, (heat?.wods?.scoring_type ?? "other") as ScoringType),
        status: r.status,
        adjusted: r.manually_adjusted,
        floorId: heat?.floor_id ?? "",
      };
    });
    const wodNames = [...new Set(scoreRows.map((r) => r.wodName))].sort();
    const divisionNames = [...new Set(scoreRows.map((r) => r.divisionName))].sort();
    ```
  - Remove the now-unused `Link`, `Badge`, `EmptyState` and `ClipboardList` imports, and the client-side sort (the table sorts).

- [ ] **Step 5: Remove the Broadcast tab.**
  - In `layout.tsx`, delete `{ slug: "broadcast", label: "Broadcast" },` from `TABS`.
  - Replace `broadcast/page.tsx` entirely with:

```tsx
import { redirect } from "next/navigation";

type Props = { params: Promise<{ eventId: string }> };

/** Broadcast was a second name for the Production board; old links land there. */
export default async function ProducerBroadcastPage({ params }: Props) {
  redirect(`/producer/events/${(await params).eventId}/production`);
}
```

- [ ] **Step 6: Rewrite `EventHeatsList.tsx` as tables.**

```tsx
import type { EventLiveFloor } from "@/lib/db/queries";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Shared "full heat schedule, grouped by floor, live heat highlighted"
// reference view — used by both the Commentator and Producer event trees
// (commentator/events/[eventId]/heats, producer/events/[eventId]/heats).
// Pure/server-safe: no client state, no realtime subscription — this is a
// glance-ahead reference, not the live-following screen (that's each role's
// Dashboard tab).
export function EventHeatsList({ floors }: { floors: EventLiveFloor[] }) {
  if (floors.length === 0) {
    return <p className="text-muted-foreground">No floors set up for this event yet.</p>;
  }
  return (
    <div className="flex flex-col gap-8">
      {floors.map((floor) => {
        const liveHeatId = floor.initialBroadcastState?.current_heat_id ?? null;
        const headingId = `floor-${floor.floorId}`;
        return (
          <section key={floor.floorId} aria-labelledby={headingId} className="flex flex-col gap-2">
            <h2
              id={headingId}
              className="text-xs font-bold tracking-widest text-muted-foreground uppercase"
            >
              {floor.venueName} — {floor.floorName}
            </h2>
            {floor.heats.length > 0 ? (
              <div className="rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Heat</TableHead>
                      <TableHead>Division</TableHead>
                      <TableHead className="w-28">State</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {floor.heats.map((h) => {
                      const live = h.id === liveHeatId;
                      return (
                        <TableRow key={h.id} data-state={live ? "selected" : undefined}>
                          <TableCell className="font-semibold whitespace-normal">
                            {h.wod.name} · Heat {h.heatNumber}
                            {h.heatCount ? ` / ${h.heatCount}` : ""}
                          </TableCell>
                          <TableCell className="whitespace-normal">{h.division.name}</TableCell>
                          <TableCell>
                            {live ? (
                              <Badge>Live</Badge>
                            ) : h.endedAt ? (
                              <Badge variant="secondary">Finished</Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No heats scheduled on this floor yet.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 7: Sponsors and Commentary as tables.**
  - **`sponsors/page.tsx`:** replace the `<ul>…</ul>` with a `<div className="rounded-xl border border-border"><Table>` that has headers **Sponsor** and **Tier** and one row per sponsor:
    - `TableCell className="font-semibold"` with `{s.business_name}`;
    - `TableCell` with the existing tier `Badge`.
  - **`commentary/page.tsx`:** do the same with headers **Commentator** and **Role**. The cells are the name and the role badge, or `—` when `role_label` is empty.
  - In both files, import `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader` and `TableRow` from `@/components/ui/table`.

- [ ] **Step 8: Run the checks.** Command: `pnpm vitest run "src/app/(app)/producer" && pnpm check`. Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add "src/app/(app)/producer/events/[eventId]/layout.tsx" "src/app/(app)/producer/events/[eventId]/broadcast/page.tsx" "src/app/(app)/producer/events/[eventId]/scores/ScoresTable.tsx" "src/app/(app)/producer/events/[eventId]/scores/ScoresTable.test.tsx" "src/app/(app)/producer/events/[eventId]/scores/page.tsx" src/components/EventHeatsList.tsx "src/app/(app)/producer/events/[eventId]/sponsors/page.tsx" "src/app/(app)/producer/events/[eventId]/commentary/page.tsx"
pnpm check && git commit -m "The producer's tabs read as tables, and Broadcast is folded into Production

Scores is a searchable, filterable table that shows each result's
score, not just its status. Heats, sponsors and commentators are tables.
Broadcast was a second name for the Production board; its tab is gone
and old links redirect.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: DESIGN.md note, browser verification, final review, PR

**Files:**
- Modify: `DESIGN.md`. Add a `### Live control boards` subsection after `### Entering scores`.
- Evidence (git-ignored): `.verify/production/*.png`

- [ ] **Step 1: DESIGN.md**

```markdown
### Live control boards

A board that drives what's on air (the producer's Production tab) opens with an **On air bar** that names what the audience sees: the heat, the clock and its state, the graphic, the lower third, the sponsor. It's sticky on screens at least 600px tall. From `lg` the board is two columns, "the floor" (heat, timer) and "the audience" (graphics, lower third, sponsors). Live controls are at least 56px (`min-h-14`). Confirm only what would hurt on air: restarting a running clock, switching heats while it runs, Reset, Clear all. Everything else is one tap, and its result shows in the bar, not in a toast.
```

- [ ] **Step 2: Browser run** with the producer dev account (`producer@repone.test`), on the event's Production tab (`/producer/events/<eventId>/production`):
  1. At 1024×768: the bar and both columns show with no vertical scroll. Check `document.documentElement.scrollHeight <= innerHeight`, or record the overflow (`board-1024.png`).
  2. At 1440×900 (`board-1440.png`) and at 390×844 (`board-390.png`, with no horizontal scroll).
  3. With no heat on air, the bar says so. Put Heat N on air.
  4. Show Lanes, a lower third and a sponsor. The bar names each (`board-on-air.png`).
  5. Start the timer, then press Start again: the restart confirmation appears (`board-restart.png`). Cancel it.
  6. Press Next heat while running: the switch confirmation appears. Cancel it.
  7. Use Clear all and confirm: the bar shows None for all three.
  8. On the Scores tab, use the status filter (DNF) and search, and open the row menu (`scores.png`). Then visit the Heats, Sponsors and Commentary tabs.
  9. `/producer/events/<eventId>/broadcast` lands on `/production`.
  10. Run Lighthouse on the Production tab, desktop and mobile. Expected: accessibility of 95 or more.

  Scores needs results. If the DB has none, enter two through the scorekeeper drawer as `scorekeeper@repone.test` before step 8. Delete them in Step 3.

- [ ] **Step 3: Clean up.**
  - Reset the floor: `update broadcast_state set current_heat_id = null, active_graphic = 'none', lower_third_athlete_id = null, active_sponsor_id = null, timer_status = 'idle', timer_elapsed_at_anchor = 0, timer_anchor_time = null where floor_id = '<floor>'`.
  - Delete any results the run added, and the standings for that WOD.
  - Close the browser pages.

- [ ] **Step 4: Commit the docs**

```bash
git add DESIGN.md
pnpm check && git commit -m "DESIGN.md says how a live control board is laid out

The On air bar, the floor and audience columns, the 56px live controls
and what deserves a confirmation, so the commentator and later boards
follow the same shape.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Final review and PR.**
  1. Run one whole-branch review on the most capable model.
  2. Fix Critical and Important findings, each with a failing test first, then run `pnpm check`.
  3. Push, and open the PR with `gh pr create --base staging`. Its body says what changed, why, and how it was verified (screenshots and Lighthouse), and ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
  4. Stop at the PR link.
