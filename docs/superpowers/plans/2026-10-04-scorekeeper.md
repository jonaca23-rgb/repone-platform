# Scorekeeper Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The scorekeeper floor screen becomes a sticky heat header, a lane list and a sticky finish bar. Each lane opens a score drawer with split min/sec entry, and the admin heat's Results tab uses the same list and drawer.

**Architecture:**
- Pure formatting helpers live in `src/lib/scoring/format.ts`.
- Shared client components live in `src/components/scoring/`:
  - `ScoreDrawer`: the form inside a `FormDialog`;
  - `LaneList`: the rows;
  - `LaneScoring`: the list and drawer together, for admin;
  - `LeaderboardSheet`.
- `enterResult` and `finishHeat` move to `safeAction` and `ActionResult`. The bulk `saveHeatResults` path is deleted.

**Tech Stack:** Next.js 16 App Router, React 19, TanStack Query (through `useServerAction`), shadcn `radix-vega` (adds `toggle` and `toggle-group`), Base UI Drawer (through `ResponsiveDialog`), Vitest 4 with Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-04-scorekeeper-design.md`

## Global Constraints

- **Branch:** `feat/scorekeeper-redesign`. The PR targets `staging`.
- **Gate:** `pnpm check` passes before every commit, chained as `pnpm check && git commit …`.
- **Staging:** stage files by name.
- **Commit messages:** a plain-sentence title saying what is now true (no `feat:` prefixes), a body saying why, and a final line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Sizes:** every target is 44px or more, and every input's text is 16px or more (`h-12 text-base`).
- **UI copy is English.** The exact strings are:
  - `Lane ${n} saved`
  - `Heat ${n} finished.`
  - `Discard changes to lane ${n}?`
  - `Production moved to ${wod} · Heat ${n}. You'll go there when you close this lane.`
  - `${done} / ${total} recorded`
  - `No scores yet.`
- **Actions:** they never `throw` a literal user-facing message and never call `redirect()`. Guards may throw, because `safeAction` converts them.
- **Scope:** only athletes are scored (`competitor_type="athlete"`). There are no notes field and no team results.
- **Tests:** a jsdom component test starts with `// @vitest-environment jsdom`. Action tests mock `server-only`, `@/lib/db/server`, `@/lib/auth/guards`, `next/cache` and `@/lib/scoring/recompute`.

## Rulings made while planning (deviations from the spec)

- **The discard confirmation is inline inside the drawer, not a second `ConfirmAction` modal.** Stacking a Radix AlertDialog over a Base UI Drawer fights over focus trapping. An inline "Discard changes to lane 3? [Keep editing] [Discard]" panel gives the same behaviour with one modal. If this is wrong, the cost is a small swap to `ConfirmAction` later.
- **The time summary uses the app's existing `formatClock`.** It renders `03:45`, not `3:45`, so it matches every other screen.

## Review Focus

1. **Refresh while the drawer is open.** A second scorekeeper's save triggers `router.refresh()`. The drawer must keep the typed values and stay open. The form's state lives in `useState` initialised once, and the drawer is keyed by heat and athlete. This is pinned by a test in Task 4.
2. **Production moves the live heat while a drawer is open.** The drawer's heat must stay put, show the notice, and jump to the live heat on close. This is pinned by `activeHeat` tests in Task 7.
3. **Blank seconds or minutes.** `joinClock("3","")` must post `3:00`, not `3:`. Both blank must post blank, so the server stores null. This is pinned in Task 1.
4. **Switching status to DNF and then back to Completed.** The typed time must still be there. The values live in parent state, not in unmounted inputs. This is pinned in Task 4.
5. **A swipe or Escape on a changed drawer.** It must not close silently, which is the same path as Cancel. This is pinned in Task 4 through `onOpenChange(false)`.

---

### Task 1: Score formatting helpers

**Files:**
- Create: `src/lib/scoring/format.ts`
- Test: `src/lib/scoring/format.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type ScoringType = "for_time" | "amrap" | "max_load" | "points" | "other";
  export type ResultStatus = "completed" | "dns" | "dnf" | "dq";
  export interface LaneResult {
    athlete_id: string | null; time_seconds: number | null; reps: number | null;
    load: number | null; points: number | null; capped: boolean; status: ResultStatus;
    tiebreak_value: number | null; manually_adjusted: boolean;
  }
  export interface ScoringLane { laneNumber: number; athleteId: string; name: string; affiliate: string | null }
  export function splitClock(seconds: number | null): { minutes: string; seconds: string };
  export function joinClock(minutes: string, seconds: string): string;
  export function scoreSummary(result: LaneResult | undefined, scoringType: ScoringType): string;
  ```

- [ ] **Step 1: Write the failing test** in `src/lib/scoring/format.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { joinClock, type LaneResult, scoreSummary, splitClock } from "./format";

const base: LaneResult = {
  athlete_id: "a", time_seconds: null, reps: null, load: null, points: null,
  capped: false, status: "completed", tiebreak_value: null, manually_adjusted: false,
};

describe("splitClock", () => {
  it("splits whole seconds", () => expect(splitClock(225)).toEqual({ minutes: "3", seconds: "45" }));
  it("pads seconds", () => expect(splitClock(63)).toEqual({ minutes: "1", seconds: "03" }));
  it("keeps a decimal", () => expect(splitClock(225.5)).toEqual({ minutes: "3", seconds: "45.5" }));
  it("pads before a decimal", () => expect(splitClock(65.5)).toEqual({ minutes: "1", seconds: "05.5" }));
  it("is blank for null", () => expect(splitClock(null)).toEqual({ minutes: "", seconds: "" }));
});

describe("joinClock", () => {
  it("joins", () => expect(joinClock("3", "45")).toBe("3:45"));
  it("fills blank minutes", () => expect(joinClock("", "45")).toBe("0:45"));
  it("fills blank seconds", () => expect(joinClock("3", "")).toBe("3:00"));
  it("is blank when both are blank", () => expect(joinClock(" ", "")).toBe(""));
  it("pads one-digit seconds", () => expect(joinClock("3", "7")).toBe("3:07"));
  it("passes junk through for the server to reject", () => expect(joinClock("3", "7x")).toBe("3:7x"));
});

describe("scoreSummary", () => {
  it("is a dash with no result", () => expect(scoreSummary(undefined, "for_time")).toBe("—"));
  it("shows DNF", () => expect(scoreSummary({ ...base, status: "dnf" }, "amrap")).toBe("DNF"));
  it("shows DNS", () => expect(scoreSummary({ ...base, status: "dns" }, "amrap")).toBe("DNS"));
  it("shows DQ", () => expect(scoreSummary({ ...base, status: "dq" }, "amrap")).toBe("DQ"));
  it("shows a time", () => expect(scoreSummary({ ...base, time_seconds: 252 }, "for_time")).toBe("04:12"));
  it("shows a cap with reps", () =>
    expect(scoreSummary({ ...base, capped: true, reps: 87 }, "for_time")).toBe("CAP 87"));
  it("shows a cap without reps", () =>
    expect(scoreSummary({ ...base, capped: true }, "for_time")).toBe("CAP"));
  it("shows reps", () => expect(scoreSummary({ ...base, reps: 87 }, "amrap")).toBe("87 reps"));
  it("shows load", () => expect(scoreSummary({ ...base, load: 120 }, "max_load")).toBe("120"));
  it("shows points", () => expect(scoreSummary({ ...base, points: 42 }, "points")).toBe("42 pts"));
  it("shows points for other", () => expect(scoreSummary({ ...base, points: 7 }, "other")).toBe("7 pts"));
  it("is a dash for a completed result with no number", () =>
    expect(scoreSummary(base, "amrap")).toBe("—"));
});
```

- [ ] **Step 2: Run it and confirm it fails.** Command: `pnpm vitest run src/lib/scoring/format.test.ts`. Expected: FAIL, because `./format` doesn't exist.

- [ ] **Step 3: Implement** `src/lib/scoring/format.ts`

```ts
import { formatClock } from "@/lib/timer/compute";

export type ScoringType = "for_time" | "amrap" | "max_load" | "points" | "other";
export type ResultStatus = "completed" | "dns" | "dnf" | "dq";

/** One saved result, as the lane list and the score drawer read it. */
export interface LaneResult {
  athlete_id: string | null;
  time_seconds: number | null;
  reps: number | null;
  load: number | null;
  points: number | null;
  capped: boolean;
  status: ResultStatus;
  tiebreak_value: number | null;
  manually_adjusted: boolean;
}

/** A lane with an athlete in it. */
export interface ScoringLane {
  laneNumber: number;
  athleteId: string;
  name: string;
  affiliate: string | null;
}

/** 225 → { "3", "45" }; 65.5 → { "1", "05.5" }; null → blanks. */
export function splitClock(seconds: number | null): { minutes: string; seconds: string } {
  if (seconds === null) return { minutes: "", seconds: "" };
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round((seconds - minutes * 60) * 1000) / 1000;
  const [whole, fraction] = String(rest).split(".");
  return {
    minutes: String(minutes),
    seconds: whole.padStart(2, "0") + (fraction ? `.${fraction}` : ""),
  };
}

/**
 * The two fields as the "m:ss" the server's clock field reads. Doesn't
 * validate: "3" + "7x" posts "3:7x" and the server names the error.
 */
export function joinClock(minutes: string, seconds: string): string {
  const m = minutes.trim();
  const s = seconds.trim();
  if (!m && !s) return "";
  const sec = !s ? "00" : /^\d$/.test(s) ? `0${s}` : s;
  return `${m || "0"}:${sec}`;
}

/** The score a lane row shows: "04:12", "CAP 87", "87 reps", "120", "42 pts", "DNF" or "—". */
export function scoreSummary(result: LaneResult | undefined, scoringType: ScoringType): string {
  if (!result) return "—";
  if (result.status !== "completed") return result.status.toUpperCase();
  if (scoringType === "for_time") {
    if (result.capped) return result.reps === null ? "CAP" : `CAP ${result.reps}`;
    return result.time_seconds === null ? "—" : formatClock(result.time_seconds);
  }
  if (scoringType === "amrap") return result.reps === null ? "—" : `${result.reps} reps`;
  if (scoringType === "max_load") return result.load === null ? "—" : String(result.load);
  return result.points === null ? "—" : `${result.points} pts`;
}
```

- [ ] **Step 4: Run it and confirm it passes.** Command: `pnpm vitest run src/lib/scoring/format.test.ts`. Expected: PASS, 23 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring/format.ts src/lib/scoring/format.test.ts
pnpm check && git commit -m "Score summaries and split min/sec entry have shared helpers

The lane list and the score drawer both need to show a result in one
line and to turn minutes and seconds into the m:ss the server reads.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `enterResult` and `finishHeat` return `ActionResult`

**Files:**
- Modify: `src/lib/actions/results.ts` (`enterResult`, lines ~126-172)
- Modify: `src/lib/actions/heats.ts` (`finishHeat`, lines ~145-176, plus its doc comment)
- Modify: `src/lib/design/uiGuard.ts:19-36` (`ACTION_RESULT_FILES`)
- Modify: `src/app/(app)/scorekeeper/[floorId]/ScoreKeeperClient.tsx`. The call sites are a stopgap; Task 7 rewrites the file.
- Test: `src/lib/actions/scoring.test.ts` (new)

**Interfaces:**
- Produces:
  - `enterResult(heatId: string, formData: FormData): Promise<ActionResult>`
  - `finishHeat(heatId: string): Promise<ActionResult>`, which on success is `okMessage(\`Heat ${n} finished.\`)`

- [ ] **Step 1: Write the failing test** in `src/lib/actions/scoring.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./testing/fakeSupabase";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.current }));
const HEAT = { id: "h-1", event_id: "ev-1", wod_id: "w-1", division_id: "d-1", floor_id: "f-1" };
vi.mock("@/lib/auth/guards", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/guards")>()),
  requireHeatAccess: async () => ({ ctx: { userId: "u-1" }, eventId: "ev-1", heat: HEAT }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/scoring/recompute", () => ({
  recomputeWodStandings: vi.fn(async () => {}),
  recomputeOverallStandings: vi.fn(async () => {}),
}));

import { finishHeat } from "./heats";
import { enterResult } from "./results";

const ATHLETE = "00000000-0000-4000-8000-000000000066";
const OTHER = "00000000-0000-4000-8000-000000000077";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

function laned(extra: Record<string, { data?: unknown; error?: { message: string } }[]> = {}) {
  return fakeSupabase({
    wods: [{ data: { scoring_type: "for_time" } }],
    lanes: [{ data: [{ athlete_id: ATHLETE, team_id: null }] }],
    registrations: [{ data: [] }],
    ...extra,
  });
}

beforeEach(() => vi.clearAllMocks());

describe("enterResult", () => {
  it("refuses a competitor outside the heat", async () => {
    db.current = laned().client;
    expect(
      await enterResult("h-1", form({ competitor_id: OTHER, time_seconds: "3:45" })),
    ).toEqual({ ok: false, message: "That competitor isn't in this heat." });
  });

  it("names a bad time on the time field", async () => {
    db.current = laned().client;
    const result = await enterResult("h-1", form({ competitor_id: ATHLETE, time_seconds: "3:7x" }));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.fieldErrors?.time_seconds?.[0]).toMatch(/Time must be a time like/);
  });

  it("saves a valid card", async () => {
    const fake = laned({ results: [{ data: null }] });
    db.current = fake.client;
    expect(
      await enterResult("h-1", form({ competitor_id: ATHLETE, time_seconds: "3:45" })),
    ).toEqual({ ok: true });
    const upsert = fake.calls.find(([t, m]) => t === "results" && m === "upsert");
    expect(upsert?.[2][0]).toMatchObject({ athlete_id: ATHLETE, time_seconds: 225 });
  });
});

describe("finishHeat", () => {
  it("says which heat finished", async () => {
    db.current = fakeSupabase({ heats: [{ data: [{ id: "h-1", heat_number: 6 }] }] }).client;
    expect(await finishHeat("h-1")).toEqual({ ok: true, message: "Heat 6 finished." });
  });

  it("fails when the heat didn't change", async () => {
    db.current = fakeSupabase({ heats: [{ data: [] }] }).client;
    const result = await finishHeat("h-1");
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.** Command: `pnpm vitest run src/lib/actions/scoring.test.ts`. Expected: FAIL. The old signatures mis-read the arguments and the actions throw instead of returning.

- [ ] **Step 3: Migrate `enterResult`** in `results.ts`. Replace the whole function and its doc comment with:

```ts
/**
 * Enters/updates the RAW result for one competitor in one heat, matching the
 * WOD's scoring type — never a single generic "score" field — then rebuilds
 * standings for that WOD+division so the leaderboard stays in sync. Used by
 * the score drawer on the Score Keeper screen and the admin heat's Results tab.
 */
export async function enterResult(heatId: string, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { ctx, eventId, heat } = await requireHeatAccess(heatId, ["scorekeeper", "producer"]);
    const form = parseForm(EnterResultForm, formData);

    const supabase = await createClient();
    const [scoringType, eligible] = await Promise.all([
      wodScoringType(supabase, heat.wod_id),
      eligibleCompetitors(supabase, heat),
    ]);
    const isAthlete = form.competitor_type === "athlete";
    if (!(isAthlete ? eligible.athletes : eligible.teams).has(form.competitor_id)) {
      throw new NotAuthorizedError("That competitor isn't in this heat.");
    }

    const row = resultRow(
      form,
      scoringType,
      {
        heat_id: heat.id,
        wod_id: heat.wod_id,
        athlete_id: isAthlete ? form.competitor_id : null,
        team_id: isAthlete ? null : form.competitor_id,
      },
      ctx.userId,
    );
    const conflictTarget = isAthlete ? "heat_id,athlete_id" : "heat_id,team_id";
    const { error } = await supabase.from("results").upsert(row, { onConflict: conflictTarget });
    if (error) throw new Error(error.message);

    await recomputeWodStandings(heat.wod_id, heat.division_id, supabase);

    revalidatePath(`/admin/events/${eventId}/heats/${heat.id}`);
    revalidatePath(`/overlay`);
    if (heat.floor_id) revalidatePath(`/scorekeeper/${heat.floor_id}`);
    return ok();
  });
}
```

Remove the comment block at the top of `results.ts` about the ignored `eventId/wodId/divisionId/scoringType/floorId` arguments, but only the sentence about `enterResult`. `saveHeatResults` still takes them until Task 6. Import `ScoringTypeDb` only if it is still used.

- [ ] **Step 4: Migrate `finishHeat`** in `heats.ts`. Add `okMessage` to the `@/lib/action-result` import. Replace the function with:

```ts
export async function finishHeat(heatId: string): Promise<ActionResult> {
  return safeAction(async () => {
    const { eventId, heat } = await requireHeatAccess(heatId, ["scorekeeper", "producer"]);
    const supabase = await createClient();
    const [finished] = expectChanged(
      await supabase
        .from("heats")
        .update({ ended_at: new Date().toISOString() })
        .eq("id", heat.id)
        .eq("event_id", eventId)
        .select("id, heat_number"),
      "finish the heat",
    );

    // The last heat finishing completes the WOD for this division, which is
    // when competitors with no result start counting as last overall.
    await recomputeOverallStandings(heat.division_id, supabase);

    revalidatePath(`/admin/events/${eventId}/heats`);
    revalidatePath(`/overlay`);
    if (heat.floor_id) revalidatePath(`/scorekeeper/${heat.floor_id}`);
    return okMessage(`Heat ${finished.heat_number} finished.`);
  });
}
```

In the doc comment above `finishHeat`, change the sentence that mentions the "Save All" button and `saveHeatResults` to: `Saving a result (enterResult) never finishes a heat; only this does.`

- [ ] **Step 5: Add both files to the guard** in `src/lib/design/uiGuard.ts`'s `ACTION_RESULT_FILES`. After `"src/lib/actions/expenses.ts",` add:

```ts
  "src/lib/actions/heats.ts",
  "src/lib/actions/results.ts",
```

- [ ] **Step 6: Stopgap callers** in `ScoreKeeperClient.tsx` (Task 7 replaces this). Change the `save=` prop to `save={async (fd) => { const r = await enterResult(heat.id, fd); if (!r.ok) throw new Error(r.message); }}`. Change `onConfirm={() => finishHeat(eventId, heat.id, floorId)}` to `onConfirm={() => finishHeat(heat.id)}`. `ConfirmAction` already handles a returned failure.

- [ ] **Step 7: Run the tests and the guard.** Commands: `pnpm vitest run src/lib/actions/scoring.test.ts src/lib/actions/heatDetail.test.ts && pnpm ui:guard`. Expected: PASS, and the guard reports no violations. If it flags a literal `throw new Error("…")` in `heats.ts` or `results.ts`, convert it to `return fail("…")` inside the `safeAction` body. Leave `throw new Error(error.message)` alone, because database errors aren't literal messages.

- [ ] **Step 8: Commit**

```bash
git add src/lib/actions/results.ts src/lib/actions/heats.ts src/lib/actions/scoring.test.ts src/lib/design/uiGuard.ts "src/app/(app)/scorekeeper/[floorId]/ScoreKeeperClient.tsx"
pnpm check && git commit -m "Entering a result and finishing a heat return ActionResult

A bad time or an athlete outside the heat now comes back as a result the
form can show next to its field, instead of an error screen. Both files
join the guard's action list.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: ToggleGroup primitive

**Files:**
- Create (generated): `src/components/ui/toggle.tsx`, `src/components/ui/toggle-group.tsx`

- [ ] **Step 1: Generate.** Command: `pnpm dlx shadcn@latest add toggle-group --yes`. Expected: both files are created and `@radix-ui/react-toggle-group` and `@radix-ui/react-toggle` (or the `radix-ui` umbrella already in `package.json`) resolve. If the CLI asks to overwrite an existing file, answer no.

- [ ] **Step 2: Check the sizes.** Open `toggle.tsx`. If the `lg` size's height is below 44px, add a size entry `touch: "min-h-11 px-4 text-base"` to `toggleVariants`. Don't change anything else.

- [ ] **Step 3: Format, lint, and commit**

```bash
git add src/components/ui/toggle.tsx src/components/ui/toggle-group.tsx package.json pnpm-lock.yaml
pnpm check && git commit -m "The UI kit has shadcn's Toggle and ToggleGroup

The score drawer picks a result's status (Completed, DNF, DNS, DQ) with a
toggle group, which announces the pressed state on its own.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Stage `package.json` and `pnpm-lock.yaml` only if they changed (`git status --short`).

---

### Task 4: `ScoreDrawer`

**Files:**
- Create: `src/components/scoring/ScoreDrawer.tsx`
- Test: `src/components/scoring/ScoreDrawer.test.tsx`

**Interfaces:**
- Consumes: Task 1's types and `splitClock`/`joinClock`; Task 2's `enterResult(heatId, fd)`; Task 3's `ToggleGroup` and `ToggleGroupItem`; `FormDialog`, `FormAlert`, `useServerAction` and `fieldErrorsOf`.
- Produces:
  ```ts
  export function ScoreDrawer(props: {
    heatId: string;
    lane: ScoringLane | null;          // null = closed
    existing: LaneResult | undefined;
    scoringType: ScoringType;
    subtitle: string;                  // "WOD 2 · Intermediate Female"
    notice?: string;                   // held-back message (Task 7)
    onClose: () => void;               // called after save, discard, or an unchanged close
  }): JSX.Element;
  ```
  The drawer is open while `lane !== null`. Callers key it by `${heatId}:${lane.athleteId}`.

- [ ] **Step 1: Write the failing test** in `src/components/scoring/ScoreDrawer.test.tsx`

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LaneResult, ScoringType } from "@/lib/scoring/format";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.stubGlobal("matchMedia", (q: string) => ({
  matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
}));
const enterResult = vi.hoisted(() => vi.fn());
vi.mock("@/lib/actions/results", () => ({ enterResult }));

import { ScoreDrawer } from "./ScoreDrawer";

const LANE = { laneNumber: 3, athleteId: "a-3", name: "Carla Ortiz", affiliate: null };

function setup(opts: { scoringType?: ScoringType; existing?: LaneResult } = {}) {
  const onClose = vi.fn();
  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <ScoreDrawer
        heatId="h-1"
        lane={LANE}
        existing={opts.existing}
        scoringType={opts.scoringType ?? "for_time"}
        subtitle="WOD 2 · Intermediate Female"
        onClose={onClose}
      />
    </QueryClientProvider>,
  );
  return { user: userEvent.setup(), onClose, view };
}

afterEach(() => {
  cleanup();
  enterResult.mockReset();
});

describe("ScoreDrawer", () => {
  it("posts minutes and seconds as m:ss", async () => {
    enterResult.mockResolvedValue({ ok: true });
    const { user, onClose } = setup();
    await user.type(screen.getByLabelText("Minutes"), "3");
    await user.type(screen.getByLabelText("Seconds"), "45");
    await user.click(screen.getByRole("button", { name: "Save lane" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const fd = enterResult.mock.calls[0][1] as FormData;
    expect(enterResult.mock.calls[0][0]).toBe("h-1");
    expect(fd.get("time_seconds")).toBe("3:45");
    expect(fd.get("competitor_id")).toBe("a-3");
    expect(fd.get("status")).toBe("completed");
  });

  it("hides score fields on DNF and keeps the time when switching back", async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText("Minutes"), "4");
    await user.click(screen.getByRole("radio", { name: "DNF" }));
    expect(screen.queryByLabelText("Minutes")).toBeNull();
    await user.click(screen.getByRole("radio", { name: "Completed" }));
    expect(screen.getByLabelText("Minutes")).toHaveProperty("value", "4");
  });

  it("asks before discarding a changed form", async () => {
    const { user, onClose } = setup();
    await user.type(screen.getByLabelText("Minutes"), "3");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("Discard changes to lane 3?")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByLabelText("Minutes")).toHaveProperty("value", "3");
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("closes an unchanged form at once", async () => {
    const { user, onClose } = setup();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows a time error under the time fields and stays open", async () => {
    enterResult.mockResolvedValue({
      ok: false,
      message: "Time must be a time like 3:45, or seconds.",
      fieldErrors: { time_seconds: ["Time must be a time like 3:45, or seconds."] },
    });
    const { user, onClose } = setup();
    await user.type(screen.getByLabelText("Seconds"), "7x");
    await user.click(screen.getByRole("button", { name: "Save lane" }));
    expect(await screen.findByText("Time must be a time like 3:45, or seconds.")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Seconds")).toHaveProperty("value", "7x");
  });

  it("keeps typed values when the saved result changes underneath", async () => {
    const { user, view } = setup();
    await user.type(screen.getByLabelText("Minutes"), "5");
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <ScoreDrawer
          heatId="h-1"
          lane={LANE}
          existing={{
            athlete_id: "a-3", time_seconds: 60, reps: null, load: null, points: null,
            capped: false, status: "completed", tiebreak_value: null, manually_adjusted: false,
          }}
          scoringType="for_time"
          subtitle="WOD 2 · Intermediate Female"
          onClose={vi.fn()}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByLabelText("Minutes")).toHaveProperty("value", "5");
  });

  it("shows reps only when capped", async () => {
    const { user } = setup();
    expect(screen.queryByLabelText("Reps")).toBeNull();
    await user.click(screen.getByRole("switch", { name: "Time-capped" }));
    expect(screen.getByLabelText("Reps")).toBeTruthy();
  });

  it("shows one field for AMRAP", () => {
    setup({ scoringType: "amrap" });
    expect(screen.getByLabelText("Total reps")).toBeTruthy();
    expect(screen.queryByLabelText("Minutes")).toBeNull();
  });
});
```

The rerender test passes a new `QueryClient`, but the drawer component instance is the same: same position, no key. It proves that the form state doesn't reset from `existing`.

- [ ] **Step 2: Run it and confirm it fails.** Command: `pnpm vitest run src/components/scoring/ScoreDrawer.test.tsx`. Expected: FAIL, because the module doesn't exist.

- [ ] **Step 3: Implement** `src/components/scoring/ScoreDrawer.tsx`

```tsx
"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { enterResult } from "@/lib/actions/results";
import {
  joinClock,
  type LaneResult,
  type ResultStatus,
  type ScoringLane,
  type ScoringType,
  splitClock,
} from "@/lib/scoring/format";
import { fieldErrorsOf, useServerAction } from "@/lib/use-server-action";
import { FormAlert } from "@/components/app/FormAlert";
import { FormDialog } from "@/components/app/FormDialog";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const STATUSES: Array<{ value: ResultStatus; label: string }> = [
  { value: "completed", label: "Completed" },
  { value: "dnf", label: "DNF" },
  { value: "dns", label: "DNS" },
  { value: "dq", label: "DQ" },
];

const BIG_INPUT = "h-12 text-base";
const text = (n: number | null | undefined) => (n == null ? "" : String(n));

/**
 * One lane's score, in a drawer on a phone and a dialog on a desktop. The
 * only place a result is typed: the Score Keeper screen and the admin heat's
 * Results tab both open it. A changed form asks before it closes.
 */
export function ScoreDrawer({
  heatId,
  lane,
  existing,
  scoringType,
  subtitle,
  notice,
  onClose,
}: {
  heatId: string;
  lane: ScoringLane | null;
  existing: LaneResult | undefined;
  scoringType: ScoringType;
  subtitle: string;
  notice?: string;
  onClose: () => void;
}) {
  const [dirty, setDirty] = useState(false);
  const [askDiscard, setAskDiscard] = useState(false);

  const close = () => {
    setDirty(false);
    setAskDiscard(false);
    onClose();
  };
  const requestClose = () => (dirty ? setAskDiscard(true) : close());

  return (
    <FormDialog
      open={lane !== null}
      onOpenChange={(next) => {
        if (!next) requestClose();
      }}
      title={lane ? `Lane ${lane.laneNumber} · ${lane.name}` : ""}
      description={subtitle}
    >
      {() =>
        lane ? (
          <ScoreForm
            heatId={heatId}
            lane={lane}
            existing={existing}
            scoringType={scoringType}
            notice={notice}
            onDirty={() => setDirty(true)}
            onSaved={close}
            onCancel={requestClose}
            askDiscard={askDiscard}
            onKeepEditing={() => setAskDiscard(false)}
            onDiscard={close}
          />
        ) : null
      }
    </FormDialog>
  );
}

function ScoreForm({
  heatId,
  lane,
  existing,
  scoringType,
  notice,
  onDirty,
  onSaved,
  onCancel,
  askDiscard,
  onKeepEditing,
  onDiscard,
}: {
  heatId: string;
  lane: ScoringLane;
  existing: LaneResult | undefined;
  scoringType: ScoringType;
  notice?: string;
  onDirty: () => void;
  onSaved: () => void;
  onCancel: () => void;
  askDiscard: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
}) {
  // Every value lives in state, initialised once: a refresh while the drawer
  // is open (another scorekeeper saved) must not overwrite what's typed, and
  // hiding the score fields for DNF must not lose them.
  const [initial] = useState(() => ({ ...splitClock(existing?.time_seconds ?? null) }));
  const [status, setStatus] = useState<ResultStatus>(existing?.status ?? "completed");
  const [minutes, setMinutes] = useState(initial.minutes);
  const [seconds, setSeconds] = useState(initial.seconds);
  const [capped, setCapped] = useState(existing?.capped ?? false);
  const [reps, setReps] = useState(text(existing?.reps));
  const [load, setLoad] = useState(text(existing?.load));
  const [points, setPoints] = useState(text(existing?.points));
  const [tiebreak, setTiebreak] = useState(text(existing?.tiebreak_value));
  const [adjusted, setAdjusted] = useState(existing?.manually_adjusted ?? false);
  const [moreOpen] = useState(
    () => existing?.tiebreak_value != null || (existing?.manually_adjusted ?? false),
  );

  const save = useServerAction((fd: FormData) => enterResult(heatId, fd), {
    success: `Lane ${lane.laneNumber} saved`,
    toastErrors: false,
    onSuccess: onSaved,
  });
  const errors = fieldErrorsOf(save.error);
  const edit =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      onDirty();
    };

  const numberField = (
    label: string,
    name: "reps" | "load" | "points",
    value: string,
    set: (v: string) => void,
    mode: "numeric" | "decimal",
  ) => (
    <div className="grid gap-2">
      <Label htmlFor={`score-${name}`}>{label}</Label>
      <Input
        id={`score-${name}`}
        name={name}
        type="text"
        inputMode={mode}
        autoComplete="off"
        value={value}
        onChange={(e) => edit(set)(e.target.value)}
        aria-invalid={errors?.[name] ? true : undefined}
        aria-describedby={errors?.[name] ? `score-${name}-error` : undefined}
        className={BIG_INPUT}
      />
      {errors?.[name] ? (
        <FieldError
          id={`score-${name}-error`}
          errors={errors[name].map((message) => ({ message }))}
        />
      ) : null}
    </div>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(new FormData(e.currentTarget));
      }}
      className="flex flex-col gap-5"
    >
      {notice ? (
        <p
          role="status"
          className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-text"
        >
          {notice}
        </p>
      ) : null}

      <input type="hidden" name="competitor_type" value="athlete" />
      <input type="hidden" name="competitor_id" value={lane.athleteId} />
      <input type="hidden" name="status" value={status} />

      <div className="grid gap-2">
        <span id="score-status-label" className="text-sm font-medium">
          Status
        </span>
        <ToggleGroup
          type="single"
          variant="outline"
          value={status}
          onValueChange={(v) => v && edit(setStatus)(v as ResultStatus)}
          aria-labelledby="score-status-label"
          className="w-full"
        >
          {STATUSES.map((s) => (
            <ToggleGroupItem key={s.value} value={s.value} className="min-h-11 flex-1 text-base">
              {s.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {status === "completed" && scoringType === "for_time" && (
        <>
          <fieldset
            className="grid gap-2"
            aria-describedby={errors?.time_seconds ? "score-time-error" : undefined}
          >
            <legend className="mb-2 text-sm font-medium">Time</legend>
            <input type="hidden" name="time_seconds" value={joinClock(minutes, seconds)} />
            <div className="flex items-end gap-2">
              <div className="grid flex-1 gap-1">
                <Label htmlFor="score-minutes" className="text-xs text-muted-foreground">
                  Minutes
                </Label>
                <Input
                  id="score-minutes"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  autoFocus
                  value={minutes}
                  onChange={(e) => edit(setMinutes)(e.target.value)}
                  aria-invalid={errors?.time_seconds ? true : undefined}
                  className="h-14 text-center font-display text-3xl tabular-nums"
                />
              </div>
              <span aria-hidden className="pb-3 font-display text-3xl">
                :
              </span>
              <div className="grid flex-1 gap-1">
                <Label htmlFor="score-seconds" className="text-xs text-muted-foreground">
                  Seconds
                </Label>
                <Input
                  id="score-seconds"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={seconds}
                  onChange={(e) => edit(setSeconds)(e.target.value)}
                  aria-invalid={errors?.time_seconds ? true : undefined}
                  className="h-14 text-center font-display text-3xl tabular-nums"
                />
              </div>
            </div>
            {errors?.time_seconds ? (
              <FieldError
                id="score-time-error"
                errors={errors.time_seconds.map((message) => ({ message }))}
              />
            ) : null}
          </fieldset>
          <Label htmlFor="score-capped" className="min-h-11 cursor-pointer gap-3 text-base">
            <Switch
              id="score-capped"
              name="capped"
              checked={capped}
              onCheckedChange={edit(setCapped)}
              aria-label="Time-capped"
            />
            Time-capped
          </Label>
          {capped && numberField("Reps", "reps", reps, setReps, "numeric")}
        </>
      )}
      {status === "completed" &&
        scoringType === "amrap" &&
        numberField("Total reps", "reps", reps, setReps, "numeric")}
      {status === "completed" &&
        scoringType === "max_load" &&
        numberField("Load", "load", load, setLoad, "decimal")}
      {status === "completed" &&
        (scoringType === "points" || scoringType === "other") &&
        numberField("Points", "points", points, setPoints, "decimal")}

      <details open={moreOpen} className="group rounded-lg border border-border">
        <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-medium">
          More
        </summary>
        <div className="flex flex-col gap-4 px-4 pb-4">
          <div className="grid gap-2">
            <Label htmlFor="score-tiebreak">Tie-break</Label>
            <Input
              id="score-tiebreak"
              name="tiebreak_value"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={tiebreak}
              onChange={(e) => edit(setTiebreak)(e.target.value)}
              className={BIG_INPUT}
            />
          </div>
          <Label htmlFor="score-adjust" className="min-h-11 cursor-pointer gap-3 text-base">
            <Switch
              id="score-adjust"
              name="manual_adjustment"
              checked={adjusted}
              onCheckedChange={edit(setAdjusted)}
              aria-label="Manual adjustment"
            />
            Manual adjustment
          </Label>
          <p className="text-sm text-muted-foreground">
            Turn this on when correcting a result after the fact, such as a resolved protest. The
            result is marked as adjusted.
          </p>
        </div>
      </details>

      <FormAlert error={save.error} />

      {askDiscard ? (
        <div
          role="alertdialog"
          aria-labelledby="score-discard-title"
          className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4"
        >
          <p id="score-discard-title" className="font-medium">
            Discard changes to lane {lane.laneNumber}?
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="touch" className="flex-1" onClick={onKeepEditing}>
              Keep editing
            </Button>
            <Button type="button" variant="destructive" size="touch" className="flex-1" onClick={onDiscard}>
              Discard
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="touch" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="touch" disabled={save.isPending} className="sm:min-w-40">
            {save.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {save.isPending ? "Saving…" : "Save lane"}
          </Button>
        </div>
      )}
    </form>
  );
}
```

**Notes for the implementer:**
- The test reaches the toggle items by role `radio`. Radix `ToggleGroup type="single"` renders `role="radio"` items with `aria-checked` inside a `role="group"`. If the generated component renders `button` with `aria-pressed` instead (with `rovingFocus` off), change the test's queries to `getByRole("button", { name: "DNF" })`, and record that in the commit body. Don't change the component to fit the test.
- Escape in jsdom: `FormDialog` renders the Radix Dialog when `matchMedia` reports "not compact" (the stub returns `matches: false`). Its Escape calls `onOpenChange(false)`, which leads to `requestClose`. If `requestClose` runs while the inline prompt is already showing, it keeps showing.
- `Switch` with `name` posts `"on"` when checked, which is what `field.checkbox()` reads. When the capped switch is off, Radix renders no value. The same holds for `manual_adjustment`.

- [ ] **Step 4: Run it and confirm it passes.** Command: `pnpm vitest run src/components/scoring/ScoreDrawer.test.tsx`. Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/scoring/ScoreDrawer.tsx src/components/scoring/ScoreDrawer.test.tsx
pnpm check && git commit -m "One drawer enters a lane's score, with minutes and seconds apart

A phone's numeric keypad has no colon, so a for-time score is two
numeric fields. A changed form asks before it closes, and a failed save
keeps the drawer open with the error under its field.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `LaneList`, `LaneScoring` and `LeaderboardSheet`

**Files:**
- Create: `src/components/scoring/LaneList.tsx`
- Create: `src/components/scoring/LaneScoring.tsx`
- Create: `src/components/scoring/LeaderboardSheet.tsx`
- Test: `src/components/scoring/LaneList.test.tsx`

**Interfaces:**
- Consumes: Task 1's `scoreSummary`, `LaneResult`, `ScoringLane` and `ScoringType`; Task 4's `ScoreDrawer`.
- Produces:
  ```ts
  export function LaneList(props: {
    lanes: ScoringLane[]; resultsByAthlete: Map<string, LaneResult>;
    scoringType: ScoringType; onOpen: (lane: ScoringLane) => void;
  }): JSX.Element;
  export function LaneScoring(props: {
    heatId: string; lanes: ScoringLane[]; results: LaneResult[];
    scoringType: ScoringType; subtitle: string;
  }): JSX.Element;
  export interface LeaderboardRow { placement: number | null; points: number | null; name: string }
  export function LeaderboardSheet(props: { title: string; rows: LeaderboardRow[] }): JSX.Element; // renders its own trigger button "Leaderboard"
  export function resultsByAthlete(results: LaneResult[]): Map<string, LaneResult>; // exported from LaneList.tsx
  ```

- [ ] **Step 1: Write the failing test** in `src/components/scoring/LaneList.test.tsx`

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LaneResult } from "@/lib/scoring/format";
import { LaneList, resultsByAthlete } from "./LaneList";

const result = (over: Partial<LaneResult>): LaneResult => ({
  athlete_id: "a-1", time_seconds: 252, reps: null, load: null, points: null,
  capped: false, status: "completed", tiebreak_value: null, manually_adjusted: false, ...over,
});

const LANES = [
  { laneNumber: 1, athleteId: "a-1", name: "Maria Rivera", affiliate: "CrossFit Aprieta" },
  { laneNumber: 2, athleteId: "a-2", name: "Ana López", affiliate: null },
  { laneNumber: 3, athleteId: "a-3", name: "Carla Ortiz", affiliate: null },
];

afterEach(cleanup);

describe("LaneList", () => {
  it("shows each lane's summary and state, and opens a lane", async () => {
    const onOpen = vi.fn();
    render(
      <LaneList
        lanes={LANES}
        scoringType="for_time"
        resultsByAthlete={resultsByAthlete([
          result({ athlete_id: "a-1" }),
          result({ athlete_id: "a-2", status: "dnf", manually_adjusted: true }),
        ])}
        onOpen={onOpen}
      />,
    );
    const row1 = screen.getByRole("button", { name: /Lane 1/ });
    expect(within(row1).getByText("04:12")).toBeTruthy();
    expect(within(row1).getByText("Recorded")).toBeTruthy();
    expect(within(row1).getByText("CrossFit Aprieta")).toBeTruthy();
    const row2 = screen.getByRole("button", { name: /Lane 2/ });
    expect(within(row2).getByText("DNF")).toBeTruthy();
    expect(within(row2).getByText("Adjusted")).toBeTruthy();
    const row3 = screen.getByRole("button", { name: /Lane 3/ });
    expect(within(row3).getByText("—")).toBeTruthy();
    expect(within(row3).getByText("Pending")).toBeTruthy();
    await userEvent.setup().click(row3);
    expect(onOpen).toHaveBeenCalledWith(LANES[2]);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.** Command: `pnpm vitest run src/components/scoring/LaneList.test.tsx`. Expected: FAIL, because the module doesn't exist.

- [ ] **Step 3: Implement** `src/components/scoring/LaneList.tsx`

```tsx
import { Check, CircleDashed, PencilLine } from "lucide-react";
import { type LaneResult, type ScoringLane, type ScoringType, scoreSummary } from "@/lib/scoring/format";
import { Badge } from "@/components/ui/badge";

const BADGE = {
  recorded: { label: "Recorded", icon: Check, className: "border-success/40 bg-success/10 text-success-text" },
  adjusted: { label: "Adjusted", icon: PencilLine, className: "border-warning/40 bg-warning/10 text-warning-text" },
  pending: { label: "Pending", icon: CircleDashed, className: "text-muted-foreground" },
} as const;

export function resultsByAthlete(results: LaneResult[]): Map<string, LaneResult> {
  const map = new Map<string, LaneResult>();
  for (const r of results) if (r.athlete_id) map.set(r.athlete_id, r);
  return map;
}

/** The heat's laned athletes, one tappable row each: lane, name, score, state. */
export function LaneList({
  lanes,
  resultsByAthlete: results,
  scoringType,
  onOpen,
}: {
  lanes: ScoringLane[];
  resultsByAthlete: Map<string, LaneResult>;
  scoringType: ScoringType;
  onOpen: (lane: ScoringLane) => void;
}) {
  return (
    <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {lanes.map((lane) => {
        const result = results.get(lane.athleteId);
        const state = !result ? "pending" : result.manually_adjusted ? "adjusted" : "recorded";
        const badge = BADGE[state];
        const Icon = badge.icon;
        return (
          <li key={lane.laneNumber}>
            <button
              type="button"
              onClick={() => onOpen(lane)}
              aria-label={`Lane ${lane.laneNumber}, ${lane.name}: ${scoreSummary(result, scoringType)}, ${badge.label}`}
              className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-hidden"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary font-display text-lg font-bold text-primary-foreground">
                {lane.laneNumber}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{lane.name}</span>
                {lane.affiliate ? (
                  <span className="block truncate text-sm text-muted-foreground">{lane.affiliate}</span>
                ) : null}
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-display text-lg tabular-nums">
                  {scoreSummary(result, scoringType)}
                </span>
                <Badge variant="outline" className={badge.className}>
                  <Icon aria-hidden />
                  {badge.label}
                </Badge>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
```

With `aria-label` on the button, the inner texts are still in the DOM, so `within(row).getByText` keeps working. The test's `name: /Lane 1/` matches the aria-label.

- [ ] **Step 4: Implement** `src/components/scoring/LaneScoring.tsx`

```tsx
"use client";

import { useMemo, useState } from "react";
import type { LaneResult, ScoringLane, ScoringType } from "@/lib/scoring/format";
import { LaneList, resultsByAthlete } from "./LaneList";
import { ScoreDrawer } from "./ScoreDrawer";

/** The lane list with its score drawer, for a page that only enters results (admin Results tab). */
export function LaneScoring({
  heatId,
  lanes,
  results,
  scoringType,
  subtitle,
}: {
  heatId: string;
  lanes: ScoringLane[];
  results: LaneResult[];
  scoringType: ScoringType;
  subtitle: string;
}) {
  const [open, setOpen] = useState<ScoringLane | null>(null);
  const byAthlete = useMemo(() => resultsByAthlete(results), [results]);
  return (
    <>
      <LaneList lanes={lanes} resultsByAthlete={byAthlete} scoringType={scoringType} onOpen={setOpen} />
      <ScoreDrawer
        key={open ? `${heatId}:${open.athleteId}` : "closed"}
        heatId={heatId}
        lane={open}
        existing={open ? byAthlete.get(open.athleteId) : undefined}
        scoringType={scoringType}
        subtitle={subtitle}
        onClose={() => setOpen(null)}
      />
    </>
  );
}
```

- [ ] **Step 5: Implement** `src/components/scoring/LeaderboardSheet.tsx`

```tsx
"use client";

import { ListOrdered } from "lucide-react";
import { useMediaQuery } from "@/lib/use-media-query";
import { COMPACT_QUERY } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface LeaderboardRow {
  placement: number | null;
  points: number | null;
  name: string;
}

/** This heat's WOD/division standings, a tap away from the finish bar. */
export function LeaderboardSheet({ title, rows }: { title: string; rows: LeaderboardRow[] }) {
  const compact = useMediaQuery(COMPACT_QUERY);
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="touch" className="gap-2 px-4">
          <ListOrdered aria-hidden />
          Leaderboard
        </Button>
      </SheetTrigger>
      <SheetContent side={compact ? "bottom" : "right"} className="max-h-[85dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        {rows.length === 0 ? (
          <p className="px-4 pb-6 text-sm text-muted-foreground">No scores yet.</p>
        ) : (
          <div className="px-4 pb-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Place</TableHead>
                  <TableHead>Athlete</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={`${r.name}-${i}`}>
                    <TableCell className="font-bold text-brand-text tabular-nums">{r.placement ?? "—"}</TableCell>
                    <TableCell className="whitespace-normal">{r.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.points ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

Check the `useMediaQuery` export name and signature in `src/lib/use-media-query.ts` before using it. `responsive-dialog.tsx` imports it, so it exists. Also check that `COMPACT_QUERY` is exported from `responsive-dialog.tsx` (it is: `export const COMPACT_QUERY`).

- [ ] **Step 6: Run it and confirm it passes.** Command: `pnpm vitest run src/components/scoring`. Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/scoring/LaneList.tsx src/components/scoring/LaneList.test.tsx src/components/scoring/LaneScoring.tsx src/components/scoring/LeaderboardSheet.tsx
pnpm check && git commit -m "A heat's lanes read as one list with each lane's score and state

Each row shows the lane, the athlete, the score in one line and whether
it's recorded, pending or adjusted, and opens the score drawer. The
leaderboard opens in a sheet.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The admin Results tab uses `LaneScoring`, and the bulk form is gone

**Files:**
- Modify: `src/app/(app)/admin/events/[eventId]/heats/[heatId]/page.tsx`. The Results branch is roughly lines 285–462; the imports are lines 1–26.
- Delete: `src/app/(app)/admin/events/[eventId]/heats/[heatId]/ResultsForm.tsx`
- Modify: `src/lib/actions/results.ts`. Delete `saveHeatResults` and `laneFields`, and drop the `ValidationError` import if it becomes unused.
- Modify: `src/lib/actions/heatDetail.test.ts`. Delete the `saveHeatResults` describe block and its import.

**Interfaces:**
- Consumes: Task 5's `LaneScoring`; Task 1's `LaneResult` and `ScoringType`.

- [ ] **Step 1: Replace the Results branch.** In `page.tsx`, replace everything from `) : tab === "results" ? (` up to (not including) `) : standings && standings.length > 0 ? (` with:

```tsx
        ) : tab === "results" ? (
          <section className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Saving here doesn&apos;t finish the heat. The heat is marked Completed from the Score
              Keeper screen.
            </p>
            {scoringLanes.length > 0 ? (
              <LaneScoring
                heatId={heatId}
                lanes={scoringLanes}
                results={(results ?? []) as unknown as LaneResult[]}
                scoringType={scoringType as ScoringType}
                subtitle={`${heat.wods?.name ?? "WOD"} · ${heat.divisions?.name ?? ""}`}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Assign athletes to lanes first.</p>
            )}
          </section>
```

Next to `laneAthleteIds`, define the following and then delete `laneAthleteIds`, `fieldClass` and `resultByAthlete` if nothing else uses them (search the file first):

```ts
const scoringLanes: ScoringLane[] = (lanes ?? [])
  .filter((l) => l.athlete_id)
  .map((l) => ({
    laneNumber: l.lane_number,
    athleteId: l.athlete_id as string,
    name: `${l.athletes?.first_name ?? ""} ${l.athletes?.last_name ?? ""}`.trim(),
    affiliate: l.athletes?.affiliate ?? null,
  }));
```

- [ ] **Step 2: Fix the imports.** Add `import { LaneScoring } from "@/components/scoring/LaneScoring";` and `import type { LaneResult, ScoringLane, ScoringType } from "@/lib/scoring/format";`. Remove `ResultsForm`, plus any of `Checkbox`, `Input`, `Label`, `Select*`, `Badge`, `PencilLine` and `formatClock` that are now unused. Run `pnpm lint` to find them.

- [ ] **Step 3: Delete the bulk path.** Run `git rm "src/app/(app)/admin/events/[eventId]/heats/[heatId]/ResultsForm.tsx"`. In `results.ts`, delete `laneFields` and `saveHeatResults` along with their doc comments. In `heatDetail.test.ts`, delete `import { saveHeatResults } from "./results";` and the whole `describe("saveHeatResults", …)` block. Then confirm nothing else references them: `grep -rn "saveHeatResults\|ResultsForm\|laneFields" src` should print nothing.

- [ ] **Step 4: Run the checks.** Command: `pnpm check`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/admin/events/[eventId]/heats/[heatId]/page.tsx" src/lib/actions/results.ts src/lib/actions/heatDetail.test.ts
pnpm check && git commit -m "The admin heat's Results tab enters scores with the scorekeeper's drawer

There is now one way to type a result. The bulk Save All form and its
action are gone; admin opens the same lane list and drawer as the floor.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

`git rm` already staged the deletion.

---

### Task 7: The scorekeeper floor screen

**Files:**
- Create: `src/app/(app)/scorekeeper/[floorId]/activeHeat.ts`
- Test: `src/app/(app)/scorekeeper/[floorId]/activeHeat.test.ts`
- Rewrite: `src/app/(app)/scorekeeper/[floorId]/ScoreKeeperClient.tsx`
- Modify: `src/app/(app)/scorekeeper/[floorId]/page.tsx`. Its `ScoreKeeperResult` import becomes `LaneResult`.

**Interfaces:**
- Consumes: Tasks 1, 2, 4 and 5.
- Produces (in `activeHeat.ts`):
  ```ts
  export function activeHeatId(args: {
    following: boolean; manualHeatId: string | null; liveHeatId: string | null;
    heldHeatId: string | null; firstHeatId: string | null;
  }): string | null;
  ```
  The rules, in order: if `heldHeatId` is set, return it; if following, return `liveHeatId ?? firstHeatId`; otherwise return `manualHeatId ?? firstHeatId`.

- [ ] **Step 1: Write the failing test** in `activeHeat.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { activeHeatId } from "./activeHeat";

const base = { following: true, manualHeatId: null, liveHeatId: "h-2", heldHeatId: null, firstHeatId: "h-1" };

describe("activeHeatId", () => {
  it("follows the live heat", () => expect(activeHeatId(base)).toBe("h-2"));
  it("falls back to the first heat with nothing live", () =>
    expect(activeHeatId({ ...base, liveHeatId: null })).toBe("h-1"));
  it("stays on the picked heat when not following", () =>
    expect(activeHeatId({ ...base, following: false, manualHeatId: "h-5" })).toBe("h-5"));
  it("holds the open drawer's heat when production moves", () =>
    expect(activeHeatId({ ...base, liveHeatId: "h-3", heldHeatId: "h-2" })).toBe("h-2"));
  it("lands on the live heat once released", () =>
    expect(activeHeatId({ ...base, liveHeatId: "h-3", heldHeatId: null })).toBe("h-3"));
});
```

- [ ] **Step 2: Run it and confirm it fails.** Command: `pnpm vitest run "src/app/(app)/scorekeeper"`. Expected: FAIL.

- [ ] **Step 3: Implement** `activeHeat.ts`

```ts
/**
 * Which heat the scorekeeper sees. An open score drawer holds its heat, so
 * Production moving the live heat never swaps the athlete under a half-typed
 * score; closing the drawer releases it. Otherwise: the live heat while
 * following, else the heat picked by hand.
 */
export function activeHeatId({
  following,
  manualHeatId,
  liveHeatId,
  heldHeatId,
  firstHeatId,
}: {
  following: boolean;
  manualHeatId: string | null;
  liveHeatId: string | null;
  heldHeatId: string | null;
  firstHeatId: string | null;
}): string | null {
  if (heldHeatId) return heldHeatId;
  if (following) return liveHeatId ?? firstHeatId;
  return manualHeatId ?? firstHeatId;
}
```

- [ ] **Step 4: Rewrite `ScoreKeeperClient.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, ListOrdered, Radio, Users } from "lucide-react";
import { useBroadcastState } from "@/lib/realtime/useBroadcastState";
import { floorWatches } from "@/lib/realtime/floorWatches";
import { useRefreshOnChanges } from "@/lib/realtime/useRefreshOnChanges";
import { finishHeat } from "@/lib/actions/heats";
import type { Database } from "@/lib/db/database.types";
import type { LaneResult, ScoringLane, ScoringType } from "@/lib/scoring/format";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { EmptyState } from "@/components/app/EmptyState";
import { LaneList, resultsByAthlete } from "@/components/scoring/LaneList";
import { type LeaderboardRow, LeaderboardSheet } from "@/components/scoring/LeaderboardSheet";
import { ScoreDrawer } from "@/components/scoring/ScoreDrawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { activeHeatId } from "./activeHeat";

export interface ScoreKeeperHeat {
  id: string;
  heatNumber: number;
  heatCount: number | null;
  endedAt: string | null;
  wod: { id: string; name: string; scoring_type: string; time_cap_seconds: number | null };
  division: { id: string; name: string };
  lanes: Array<{ laneNumber: number; athleteId: string | null; name: string | null; affiliate: string | null }>;
}

export interface ScoreKeeperStanding extends LeaderboardRow {
  athlete_id: string | null;
}

type BroadcastStateRow = Database["public"]["Tables"]["broadcast_state"]["Row"];

const heatLabel = (h: ScoreKeeperHeat) => `${h.wod.name} · Heat ${h.heatNumber}`;

export function ScoreKeeperClient({
  floorId,
  heats,
  initialBroadcastState,
  resultsByHeatId,
  standingsByHeatId,
}: {
  floorId: string;
  heats: ScoreKeeperHeat[];
  initialBroadcastState: BroadcastStateRow | null;
  resultsByHeatId: Record<string, LaneResult[]>;
  standingsByHeatId: Record<string, ScoreKeeperStanding[]>;
}) {
  const { state, connected } = useBroadcastState(floorId, initialBroadcastState);
  const liveHeatId = state?.current_heat_id ?? null;
  // A second scorekeeper's saves and lane changes from Admin show up here
  // without a reload; an open drawer keeps what's typed across the refresh.
  useRefreshOnChanges(floorWatches(floorId, heats.map((h) => h.id), { results: true }));

  // By default the screen follows the heat Production has live; picking a
  // heat by hand steps off that, and "Follow live" steps back on.
  const [following, setFollowing] = useState(true);
  const [manualHeatId, setManualHeatId] = useState<string | null>(null);
  // The lane whose drawer is open, and the heat it belongs to (held while open).
  const [open, setOpen] = useState<{ heatId: string; lane: ScoringLane } | null>(null);

  const currentId = activeHeatId({
    following,
    manualHeatId,
    liveHeatId,
    heldHeatId: open?.heatId ?? null,
    firstHeatId: heats[0]?.id ?? null,
  });
  const heat = heats.find((h) => h.id === currentId) ?? heats[0] ?? null;
  const liveHeat = heats.find((h) => h.id === liveHeatId) ?? null;
  const results = useMemo(
    () => resultsByAthlete(heat ? (resultsByHeatId[heat.id] ?? []) : []),
    [heat, resultsByHeatId],
  );

  if (!heat) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState
          icon={ListOrdered}
          title="No heats scheduled on this floor yet"
          description="Set them up in Admin → Heats & Lanes."
        />
      </div>
    );
  }

  const scoringType = heat.wod.scoring_type as ScoringType;
  const lanes: ScoringLane[] = heat.lanes
    .filter((l) => l.athleteId)
    .map((l) => ({
      laneNumber: l.laneNumber,
      athleteId: l.athleteId as string,
      name: l.name ?? "—",
      affiliate: l.affiliate,
    }));
  const recorded = lanes.filter((l) => results.has(l.athleteId)).length;
  const missing = lanes.length - recorded;
  const index = heats.findIndex((h) => h.id === heat.id);
  const pick = (id: string) => {
    setFollowing(false);
    setManualHeatId(id);
  };
  const subtitle = `${heat.wod.name} · ${heat.division.name}`;
  const heldBack =
    open && following && liveHeat && liveHeat.id !== open.heatId
      ? `Production moved to ${heatLabel(liveHeat)}. You'll go there when you close this lane.`
      : undefined;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-3xl flex-col">
      {/* Sticky heat header */}
      <header className="sticky top-0 z-10 flex flex-col gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 font-display text-2xl font-bold tracking-wide uppercase">
              {heatLabel(heat)}
              {heat.heatCount ? ` / ${heat.heatCount}` : ""}
              {heat.endedAt && (
                <Badge variant="outline" className="border-success/40 bg-success/10 text-success-text">
                  <Check aria-hidden />
                  Finished
                </Badge>
              )}
            </h1>
            <p className="truncate text-sm font-semibold tracking-wide text-brand-text uppercase">
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
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label="Previous heat"
            disabled={index <= 0}
            onClick={() => index > 0 && pick(heats[index - 1].id)}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Label htmlFor="scorekeeper-heat" className="sr-only">
            Heat
          </Label>
          <Select value={heat.id} onValueChange={pick}>
            <SelectTrigger id="scorekeeper-heat" className="min-w-0 flex-1 data-[size=default]:h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {heats.map((h) => (
                <SelectItem key={h.id} value={h.id}>
                  {heatLabel(h)} ({h.division.name})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label="Next heat"
            disabled={index === -1 || index >= heats.length - 1}
            onClick={() => index < heats.length - 1 && pick(heats[index + 1].id)}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
        {following ? (
          <span className="flex items-center gap-2 text-xs font-semibold tracking-wide text-brand-text uppercase">
            <Radio className="size-4" aria-hidden />
            Following live heat
          </span>
        ) : (
          <Button
            type="button"
            variant="secondary"
            className="min-h-11 w-fit gap-2"
            onClick={() => {
              setFollowing(true);
              setManualHeatId(null);
            }}
          >
            <Radio aria-hidden />
            Follow live heat
          </Button>
        )}
      </header>

      {/* Lane list */}
      <main className="flex-1 px-4 py-4">
        {lanes.length > 0 ? (
          <LaneList
            lanes={lanes}
            resultsByAthlete={results}
            scoringType={scoringType}
            onOpen={(lane) => setOpen({ heatId: heat.id, lane })}
          />
        ) : (
          <EmptyState
            icon={Users}
            title="No athletes in lanes for this heat yet"
            description="Set that up in Admin → Heats & Lanes."
          />
        )}
      </main>

      {/* Sticky finish bar */}
      <footer className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <p className="text-sm font-medium tabular-nums">
          {recorded} / {lanes.length} recorded
        </p>
        <div className="flex items-center gap-2">
          <LeaderboardSheet
            title={`Leaderboard — ${heat.wod.name} (${heat.division.name})`}
            rows={standingsByHeatId[heat.id] ?? []}
          />
          {heat.endedAt ? (
            <Button type="button" size="touch" disabled>
              Heat finished
            </Button>
          ) : (
            <ConfirmAction
              trigger="Finish heat"
              triggerVariant="default"
              triggerSize="touch"
              variant="default"
              title={`Finish Heat ${heat.heatNumber}?`}
              description={`${heat.wod.name} (${heat.division.name}) is marked completed.${
                missing > 0
                  ? ` ${missing} lane${missing === 1 ? " has" : "s have"} no result and will count as last once the WOD is finished.`
                  : ""
              }`}
              confirmLabel="Finish heat"
              onConfirm={() => finishHeat(heat.id)}
            />
          )}
        </div>
      </footer>

      <ScoreDrawer
        key={open ? `${open.heatId}:${open.lane.athleteId}` : "closed"}
        heatId={open?.heatId ?? heat.id}
        lane={open?.lane ?? null}
        existing={open ? results.get(open.lane.athleteId) : undefined}
        scoringType={scoringType}
        subtitle={subtitle}
        notice={heldBack}
        onClose={() => setOpen(null)}
      />
    </div>
  );
}
```

**Notes for the implementer:**
- When a heat has no laned athletes, hide the Finish button, as today. Wrap the `heat.endedAt ? … : …` in `lanes.length > 0 &&`. The bar then shows `0 / 0 recorded` and the Leaderboard button only.
- `OperatorShell` may already render a `<main>`. Check `src/components/shells/OperatorShell.tsx`. If it does, change the lane list's `<main>` to a `<section aria-label="Lanes">`.
- The header's sticky `top-0` must clear the shell's own header. If `OperatorShell`'s header is sticky too, use its height (inspect it) as the `top-*` offset.
- `heat` is the held heat while a drawer is open, so `results` and `scoringType` are the drawer's.

- [ ] **Step 5: Update `page.tsx`.**
  - Import `LaneResult` from `@/lib/scoring/format` in place of `ScoreKeeperResult`.
  - Type `resultsByHeatId` as `Record<string, LaneResult[]>` and cast each row with `as unknown as LaneResult`.
  - Stop passing `eventId`, which the client no longer takes.
  - `ScoreKeeperStanding` keeps `placement`, `points`, `athlete_id` and `name`, so the standings mapping is unchanged.

- [ ] **Step 6: Run the checks.** Command: `pnpm check`. Expected: PASS. Every `ScoreKeeperResult` reference is gone (`grep -rn ScoreKeeperResult src` prints nothing).

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/scorekeeper/[floorId]/activeHeat.ts" "src/app/(app)/scorekeeper/[floorId]/activeHeat.test.ts" "src/app/(app)/scorekeeper/[floorId]/ScoreKeeperClient.tsx" "src/app/(app)/scorekeeper/[floorId]/page.tsx"
pnpm check && git commit -m "The scorekeeper floor is a sticky heat header, a lane list and a finish bar

On a phone the heat and the finish button stay on screen while the
lanes scroll, and each lane opens the score drawer. An open drawer holds
its heat if Production moves on, and lets go when it closes.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: DESIGN.md note and browser verification

**Files:**
- Modify: `DESIGN.md`. Add a new `### Entering scores` subsection inside "## Building an admin screen", right before `### Checklist for a new admin screen`.
- Evidence (git-ignored): `.verify/scorekeeper/*.png`

- [ ] **Step 1: Add to DESIGN.md**

```markdown
### Entering scores

A result is typed in one place: `ScoreDrawer` (`src/components/scoring/`). A page that only enters results renders `LaneScoring` (the lane list plus the drawer). A page with more around it, such as the Score Keeper floor, composes `LaneList` and `ScoreDrawer` itself. A for-time score is minutes and seconds in two numeric fields, joined by `joinClock`; never a single `mm:ss` text field, because a phone's numeric keypad has no colon. Don't build a second entry form.
```

- [ ] **Step 2: Browser run.** The dev server is on :3200. Sign in as the scorekeeper dev account, and as the admin for the last item. For each item, save a screenshot to `.verify/scorekeeper/`. Use Chrome DevTools MCP with `emulate` for the viewport.
  1. At 390×844 on `/scorekeeper/<floorId>`: the header and finish bar are sticky while scrolling, and at least six lanes are visible (`sk-390.png`).
  2. Open a lane and enter 3 and 45, then save. Expected: a "Lane N saved" toast, and the row shows `03:45 Recorded` (`sk-saved.png`).
  3. Open a lane, turn Time-capped on, enter reps 87, and save. Expected: `CAP 87`.
  4. Open a lane, press DNF, and save. Expected: `DNF`.
  5. Open a lane and enter seconds `7x`, then save. Expected: the error appears under the time fields and the drawer stays open (`sk-error.png`).
  6. Type a value and swipe down or press Escape. Expected: the discard prompt appears (`sk-discard.png`).
  7. At 390×400 (keyboard up), open a lane. Expected: Save lane is visible and works (`sk-390x400.png`).
  8. At 820×1180, the drawer renders as a dialog (`sk-820.png`).
  9. Open the Leaderboard. Expected: the sheet shows the table (`sk-leaderboard.png`).
  10. Use Finish heat and confirm. Expected: a "Heat N finished." toast and the Finished badge.
  11. As admin on `/admin/events/<id>/heats/<heatId>?tab=results`, enter a score through the drawer (`admin-results.png`).
  12. Run Lighthouse in mobile mode on the floor screen. Expected: accessibility of 95 or more. Record the score.

- [ ] **Step 3: Clean up.** Restore the test heat's results and `ended_at` in the local DB, for example with `psql` against the local Supabase URL. Use separate `-c` flags: `update heats set ended_at = null where id = '<id>'` and `delete from results where heat_id = '<id>' and entered_by = '<scorekeeper user id>'`. Then close every browser page that was opened.

- [ ] **Step 4: Commit**

```bash
git add DESIGN.md
pnpm check && git commit -m "DESIGN.md says where a score is entered

One drawer enters every result; the note names the parts and why time
is two numeric fields, so a later screen doesn't build a second form.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Final review and PR.** Dispatch one whole-branch reviewer on the most capable model. Apply its confirmed findings, each with a failing test first where testable, then run `pnpm check`. Push, and open a PR against `staging` with `gh pr create --base staging`. The body covers what changed, why, and how it was verified, including the screenshot list and the Lighthouse score, and ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Stop at the PR link.
