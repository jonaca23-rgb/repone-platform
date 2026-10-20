# Broadcast Overlays Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every overlay renders on a 1920×1080 stage that scales to the viewport and stays inside the 5% safe area. Graphics use one broadcast type scale and enter and leave with motion. In Program the timer becomes a corner clock. The index becomes an operator page, and a new calibration page lets the operator check the picture on the device.

**Architecture:**
- Pure scale maths lives in `lib/broadcast/stage.ts`.
- Three new client components in `components/graphics/`:
  - `BroadcastStage` (with `SafeArea`), the scaled stage;
  - `Appear`, presence plus keyframes;
  - `ClockBug`.
- The existing graphics keep their props, but their layout moves to stage pixels.
- Every overlay route renders inside the stage.

**Tech Stack:** Next.js 16, React 19, Tailwind 4 `@theme` tokens and keyframes, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-05-broadcast-overlays-design.md`

## Global Constraints

- **Branch and PR:** `feat/broadcast-overlays`, PR against `staging`.
- **Commits:**
  - Chain every commit as `pnpm check && git commit …`.
  - Stage files by name.
  - Title is a plain sentence, the body says why, and it ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Stage geometry:** 1920×1080, with a safe area of 96px on the sides and 54px top and bottom.
- **Motion:** only `transform` and `opacity`; no blur, filters or backdrop. Enter and exit run 300ms, and `EXIT_MS` is 320.
- **Overlay pages:** `html` and `body` stay transparent. The overlay root layout already sets `bg-transparent`, so don't add a background to any wrapper except full-frame cards, the index page and the test page.
- **No `shadcn/ui` inside broadcast graphics**, per DESIGN.md. The index page may use plain buttons styled with `--broadcast-*` tokens.
- **Copy (exact strings):**
  - `YoloBox or a single browser source: add Program. It shows whatever Production puts on air.`
  - `Copy URL`
  - `Copied`
  - `Preview`
  - `Check the picture on your device`
  - `If you can see your camera behind this text, the background is transparent.`

## Review Focus

1. **A 1280×720 viewport:** nothing may be cut off. Checked in the Task 5 browser run with `getBoundingClientRect`.
2. **Switching cards (lanes → leaderboard):** the old card must exit and the new one enter, with no blank frame between them and no stacking. Pinned in Task 2's `Appear` test (exit stays mounted) and Task 3's Program test.
3. **A lower third while a card shows:** both render, with the lower third on top. Pinned in Task 3.
4. **Reduced motion:** no animation and no 320ms lingering. Pinned in Task 2.
5. **Before the first measurement:** no unscaled frame is visible. Pinned in Task 1 (`visibility: hidden` until measured).

---

### Task 1: The stage, the safe area and the type scale

**Files:**
- Create: `src/lib/broadcast/stage.ts`
- Create: `src/lib/broadcast/stage.test.ts`
- Create: `src/components/graphics/BroadcastStage.tsx`
- Create: `src/components/graphics/BroadcastStage.test.tsx`
- Modify: `src/app/globals.css` (`@theme` adds `--text-bc-*`)

**Interfaces:** Produces:
- `STAGE = { width: 1920, height: 1080, safeX: 96, safeY: 54 }`
- `stageScale(w, h): number`
- `stageOffset(w, h): { x: number; y: number }`
- `<BroadcastStage>`
- `<SafeArea className?>`

- [ ] **Step 1: Write the failing tests.**

`stage.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { stageOffset, stageScale } from "./stage";

describe("stageScale", () => {
  it.each([
    [1920, 1080, 1],
    [1280, 720, 2 / 3],
    [3840, 2160, 2],
    [1080, 1920, 0.5625],
  ])("%ix%i scales by %f", (w, h, s) => expect(stageScale(w, h)).toBeCloseTo(s));
});

describe("stageOffset", () => {
  it("centres a letterboxed stage", () => {
    expect(stageOffset(1080, 1920)).toEqual({ x: 0, y: (1920 - 1080 * 0.5625) / 2 });
  });
  it("is zero when the viewport matches", () => expect(stageOffset(1280, 720)).toEqual({ x: 0, y: 0 }));
});
```

`BroadcastStage.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BroadcastStage } from "./BroadcastStage";

afterEach(cleanup);

describe("BroadcastStage", () => {
  it("scales the 1920x1080 stage to the window once it has measured it", async () => {
    Object.assign(window, { innerWidth: 1280, innerHeight: 720 });
    render(
      <BroadcastStage>
        <p>Graphic</p>
      </BroadcastStage>,
    );
    const stage = screen.getByTestId("broadcast-stage");
    expect(stage.style.width).toBe("1920px");
    expect(stage.style.height).toBe("1080px");
    expect(stage.style.transform).toContain("scale(0.666");
    expect(stage.style.visibility).toBe("visible");
    Object.assign(window, { innerWidth: 3840, innerHeight: 2160 });
    await act(async () => window.dispatchEvent(new Event("resize")));
    expect(stage.style.transform).toContain("scale(2)");
  });
});
```

- [ ] **Step 2: Run them and confirm they fail.** `pnpm vitest run src/lib/broadcast src/components/graphics` should fail because the modules are missing.

- [ ] **Step 3: Implement.**

`src/lib/broadcast/stage.ts`:

```ts
/** Every overlay is laid out on this stage and scaled to the viewport. */
export const STAGE = { width: 1920, height: 1080, safeX: 96, safeY: 54 } as const;

/** How much the 1920x1080 stage scales to fit a viewport, keeping its shape. */
export function stageScale(width: number, height: number): number {
  return Math.min(width / STAGE.width, height / STAGE.height);
}

/** Where the scaled stage starts, so it sits centred in a viewport of another shape. */
export function stageOffset(width: number, height: number): { x: number; y: number } {
  const s = stageScale(width, height);
  return { x: (width - STAGE.width * s) / 2, y: (height - STAGE.height * s) / 2 };
}
```

`src/components/graphics/BroadcastStage.tsx`:

```tsx
"use client";

import { useLayoutEffect, useState } from "react";
import { STAGE, stageOffset, stageScale } from "@/lib/broadcast/stage";
import { cn } from "@/lib/utils";

/**
 * The 1920x1080 stage every overlay is drawn on, scaled to whatever viewport
 * the browser source gives it: YoloBox may render a web overlay at 1280x720,
 * OBS at 1080p or 4K. Hidden until measured, so a small viewport never shows
 * an unscaled, cut-off frame. The background stays transparent.
 */
export function BroadcastStage({ children }: { children: React.ReactNode }) {
  const [fit, setFit] = useState<{ s: number; x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const { innerWidth: w, innerHeight: h } = window;
      setFit({ s: stageScale(w, h), ...stageOffset(w, h) });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  return (
    <div className="fixed inset-0 overflow-hidden">
      <div
        data-testid="broadcast-stage"
        className="absolute top-0 left-0 origin-top-left"
        style={{
          width: `${STAGE.width}px`,
          height: `${STAGE.height}px`,
          transform: fit ? `translate(${fit.x}px, ${fit.y}px) scale(${fit.s})` : undefined,
          visibility: fit ? "visible" : "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** The 5% action-safe area of the stage: anything that must never be cut off goes in here. */
export function SafeArea({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn("absolute", className)}
      style={{ inset: `${STAGE.safeY}px ${STAGE.safeX}px` }}
    >
      {children}
    </div>
  );
}
```

In `globals.css`'s `@theme inline` block (next to the `--color-broadcast-*` lines), add:

```css
  --text-bc-hero: 112px;
  --text-bc-title: 64px;
  --text-bc-body: 40px;
  --text-bc-label: 26px;
  --text-bc-clock: 96px;
```

If the `@theme` block isn't `inline`, add them to the block that holds the colour tokens.

- [ ] **Step 4: Run the tests and confirm they pass.** If jsdom doesn't flush the `useLayoutEffect` before the first assertion, wrap the `render` in `act`.

- [ ] **Step 5: Commit.** Title: "Overlays draw on a 1920x1080 stage that scales to the browser source".

---

### Task 2: Motion (`Appear`) and the corner clock (`ClockBug`)

**Files:**
- Create: `src/components/graphics/Appear.tsx`
- Create: `src/components/graphics/Appear.test.tsx`
- Create: `src/components/graphics/ClockBug.tsx`
- Modify: `src/app/globals.css` (keyframes and the reduced-motion rule)

**Interfaces:** Produces:
- `<Appear show variant="slide-left" | "rise" | "fade">`
- `EXIT_MS = 320`
- `<ClockBug seconds atLimit>`

- [ ] **Step 1: Write the failing test.**

```tsx
// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Appear, EXIT_MS } from "./Appear";

function motion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: reduce && q === "(prefers-reduced-motion: reduce)",
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Appear", () => {
  it("enters, then plays its exit before unmounting", () => {
    motion(false);
    const view = render(<Appear show variant="rise"><p>Card</p></Appear>);
    expect(screen.getByText("Card").closest("[data-appear]")?.getAttribute("data-appear")).toBe("in");
    view.rerender(<Appear show={false} variant="rise"><p>Card</p></Appear>);
    expect(screen.getByText("Card").closest("[data-appear]")?.getAttribute("data-appear")).toBe("out");
    act(() => vi.advanceTimersByTime(EXIT_MS));
    expect(screen.queryByText("Card")).toBeNull();
  });

  it("swaps content in place while shown", () => {
    motion(false);
    const view = render(<Appear show variant="slide-left"><p>Maria</p></Appear>);
    view.rerender(<Appear show variant="slide-left"><p>Sofia</p></Appear>);
    expect(screen.getByText("Sofia")).toBeTruthy();
    expect(screen.queryByText("Maria")).toBeNull();
  });

  it("leaves at once with reduced motion", () => {
    motion(true);
    const view = render(<Appear show variant="fade"><p>Clock</p></Appear>);
    view.rerender(<Appear show={false} variant="fade"><p>Clock</p></Appear>);
    expect(screen.queryByText("Clock")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.**

- [ ] **Step 3: Implement `Appear.tsx`.**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

export const EXIT_MS = 320;

type Variant = "slide-left" | "rise" | "fade";

function reducedMotion() {
  return typeof window !== "undefined" &&
    (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
}

/**
 * Shows a broadcast graphic with an entrance and keeps it on screen through
 * its exit, so graphics move on and off air instead of popping. Content that
 * changes while shown swaps in place. With reduced motion it simply appears
 * and disappears.
 */
export function Appear({
  show,
  variant,
  children,
}: {
  show: boolean;
  variant: Variant;
  children: React.ReactNode;
}) {
  const [leaving, setLeaving] = useState<React.ReactNode | null>(null);
  const last = useRef<React.ReactNode>(children);
  if (show) last.current = children;

  useEffect(() => {
    if (show) {
      setLeaving(null);
      return;
    }
    if (reducedMotion()) {
      setLeaving(null);
      return;
    }
    setLeaving(last.current);
    const t = setTimeout(() => setLeaving(null), EXIT_MS);
    return () => clearTimeout(t);
  }, [show]);

  if (show) return <div data-appear="in" className={`bc-in-${variant}`}>{children}</div>;
  if (leaving) return <div data-appear="out" className={`bc-out-${variant}`}>{leaving}</div>;
  return null;
}
```

The `useEffect` deliberately calls setState. Add the same `react-hooks/set-state-in-effect` disable comment the repo uses elsewhere, with a reason.

The test checks `data-appear="out"` right after the rerender to `show={false}`. That works only if the effect has run, so the rerender must happen inside `act`; RTL's `rerender` already wraps it.

`ClockBug.tsx`:

```tsx
import { formatClock } from "@/lib/timer/compute";

/** The running clock as a corner bug over live video: compact, tabular, accent at the limit. */
export function ClockBug({ seconds, atLimit }: { seconds: number; atLimit: boolean }) {
  return (
    <div className="bg-broadcast-bg px-[28px] py-[10px] shadow-2xl">
      <span
        className={`font-display text-bc-clock leading-none font-bold tabular-nums ${
          atLimit ? "text-broadcast-accent" : "text-broadcast-fg"
        }`}
      >
        {formatClock(seconds)}
      </span>
    </div>
  );
}
```

Keyframes go in `globals.css`, outside `@theme`:

```css
/* Broadcast motion: transform and opacity only (YoloBox's browser is a WebView). */
@keyframes bc-slide-in-left { from { opacity: 0; transform: translateX(-40px); } to { opacity: 1; transform: none; } }
@keyframes bc-slide-out-left { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateX(-40px); } }
@keyframes bc-rise-in { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
@keyframes bc-rise-out { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(24px); } }
@keyframes bc-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes bc-fade-out { from { opacity: 1; } to { opacity: 0; } }
.bc-in-slide-left { animation: bc-slide-in-left 300ms cubic-bezier(.2,.8,.2,1) both; }
.bc-out-slide-left { animation: bc-slide-out-left 300ms cubic-bezier(.2,.8,.2,1) both; }
.bc-in-rise { animation: bc-rise-in 300ms cubic-bezier(.2,.8,.2,1) both; }
.bc-out-rise { animation: bc-rise-out 300ms cubic-bezier(.2,.8,.2,1) both; }
.bc-in-fade { animation: bc-fade-in 300ms ease-out both; }
.bc-out-fade { animation: bc-fade-out 300ms ease-out both; }
@media (prefers-reduced-motion: reduce) {
  .bc-in-slide-left, .bc-out-slide-left, .bc-in-rise, .bc-out-rise, .bc-in-fade, .bc-out-fade { animation: none; }
}
```

- [ ] **Step 4: Run the tests, run the checks, and commit.** Title: "Broadcast graphics move on and off air, and the clock has a corner bug".

---

### Task 3: Graphics on stage pixels, and Program's layers

**Files:**
- Modify: `src/components/graphics/{HeatIdentification,LanesBoard,WodCard,SponsorCard,HeatResults,Leaderboard,LowerThird}.tsx`
- Rewrite: `src/app/(overlay)/overlay/[floorId]/program/ProgramOverlayClient.tsx`
- Test: `src/app/(overlay)/overlay/[floorId]/program/ProgramOverlayClient.test.tsx`

**Graphic conversions** (props unchanged):
- **The `fullScreen` wrappers:** `h-screen w-screen` becomes `absolute inset-0`. Keep the background. Lay the content out inside the safe area with `px-[96px] py-[54px]` on the full-frame wrapper, or by wrapping it in `SafeArea`.
- **Type scale:**
  - card titles (`text-5xl` / `text-3xl` display) → `text-bc-hero` or `text-bc-title`;
  - row names and values (`text-xl` / `text-3xl`) → `text-bc-body`;
  - labels, divisions and affiliates (`text-sm` / `text-lg` / `text-2xl` secondary) → `text-bc-label`;
  - lane and placement badges scale with their rows: `h-[72px] w-[72px]` with `text-bc-body`.
- **Compact (non-fullScreen) variants:** keep their structure and move them to stage sizes.
  - `HeatIdentification` strip: `text-bc-title` for the name, `text-bc-label` for the division.
  - `LanesBoard` compact: `text-bc-label` names and 48px badges.
  - `Leaderboard` compact: `w-[640px]`, `text-bc-label` rows and a `text-bc-body` title.
- **`LowerThird`:** remove `absolute bottom-[8%] left-[4%]`, because the parent places it. Name in `text-bc-title`, the line under it in `text-bc-label`.

**Program layers:**

```tsx
<BroadcastStage>
  {/* Cards: one at a time, the old one exits while the new one enters. */}
  <Appear show={graphic === "heat_intro" && !!currentHeat} variant="rise">{heatIntro}</Appear>
  <Appear show={graphic === "lanes" && !!currentHeat} variant="rise">{lanesCard}</Appear>
  <Appear show={graphic === "wod" && !!currentHeat} variant="rise">{wodCard}</Appear>
  <Appear show={graphic === "score" && !!currentHeat} variant="rise">{resultsCard}</Appear>
  <Appear show={graphic === "leaderboard" && !!currentHeat} variant="rise">{leaderboardCard}</Appear>
  <Appear show={graphic === "sponsor" && !!activeSponsor} variant="rise">{sponsorCard}</Appear>
  {/* Timer: corner bugs over live video, not a full-frame card. */}
  <SafeArea>
    <div className="absolute top-0 left-0"><Appear show={graphic === "timer" && !!currentHeat} variant="fade">{heatStrip}</Appear></div>
    <div className="absolute top-0 right-0"><Appear show={graphic === "timer"} variant="fade"><ClockBug … /></Appear></div>
    <div className="absolute bottom-0 left-0"><Appear show={!!state?.lower_third_athlete_id && !!lowerThirdAthlete} variant="slide-left">{lowerThird}</Appear></div>
  </SafeArea>
</BroadcastStage>
```

The card elements are built exactly as the current file builds them, with the same data mapping.
- Each full-frame card is `absolute inset-0` inside the stage.
- The `Leaderboard` card renders `fullScreen`. The current `<div className="flex h-screen…"><Leaderboard/></div>` wrapper goes away.
- `Appear`'s wrapper `div` must not break `absolute inset-0` children. Give the `Appear` wrapper `className` support, or make its `div` `contents` for card variants. Use `className="contents"` via an optional `className` prop on `Appear`, and add that prop to Task 2's component.

- [ ] **Step 1: Write the failing Program test.**
  - Mock `useFloorOverlay` (returning `{ state, currentHeat }` from a mutable fixture), `useLiveTimer`, `useStandings`, `useHeatResults` and `useAthleteLookup`, as `DashboardClient.test` does. Stub `matchMedia` (no reduced motion).
  - Cases:
    1. `active_graphic: "timer"` → the clock text (`formatClock(462)`, i.e. `07:42`) and the heat strip (WOD name) render. The lanes names and the full-frame heat intro don't.
    2. `"lanes"` with `lower_third_athlete_id` set and the athlete lookup returning a name → the lane names and the lower-third name both render.
    3. Switching the fixture from `"lanes"` to `"leaderboard"` and rerendering → the lanes card is still in the DOM with `data-appear="out"`, and the leaderboard title is in with `"in"` (Review Focus 2).

- [ ] **Step 2: Run it and confirm it fails.** Expected FAIL: today's timer is full-screen and there is no `data-appear`.

- [ ] **Step 3: Convert the graphics and rewrite Program as above.** Then run `pnpm vitest run "src/app/(overlay)" src/components/graphics && pnpm check`.

- [ ] **Step 4: Commit.** Title: "Program layers its cards, a corner clock and the lower third inside the safe area".

---

### Task 4: Single routes, the operator index and the calibration page

**Files:**
- Modify: the seven single-route clients (`timer`, `heat`, `lanes`, `leaderboard`, `wod`, `sponsor`, `lower-third`)
- Rewrite: `src/app/(overlay)/overlay/[floorId]/page.tsx`
- Create: `src/app/(overlay)/overlay/[floorId]/OverlayLinks.tsx` (client: copy buttons)
- Test: `OverlayLinks.test.tsx`
- Create: `src/app/(overlay)/overlay/[floorId]/test/page.tsx`
- Create: `src/app/(overlay)/overlay/[floorId]/test/CalibrationReadout.tsx` (client)

**Single routes.** Each route's wrapper changes from `<div className="flex h-screen w-screen … p-8">` to `<BroadcastStage><SafeArea>` plus an absolutely placed slot:

| Route | Placement |
|---|---|
| timer | `top-0 right-0`, `ClockBug` |
| heat | `top-0 left-0`, strip |
| lanes | `top-[120px] left-0`, compact board |
| leaderboard | `top-1/2 right-0 -translate-y-1/2` |
| wod | `top-1/2 left-0 -translate-y-1/2` |
| sponsor | `bottom-0 right-0` |
| lower-third | `bottom-0 left-0` |

Wrap each in the matching `<Appear>` (`fade` for timer and heat, `rise` for the cards, `slide-left` for lower-third), shown on the same condition that today returns `null`.

**`OverlayLinks`** (client):

```tsx
"use client";

import { useState } from "react";

export interface OverlaySource { slug: string; name: string; description: string }

/** One row per browser source: what it is, its full URL, Copy and Preview. */
export function OverlayLinks({ origin, floorId, sources }: { origin: string; floorId: string; sources: OverlaySource[] }) {
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <ul className="flex flex-col gap-3">
      {sources.map((s) => {
        const url = `${origin}/overlay/${floorId}/${s.slug}`;
        return (
          <li key={s.slug} className="flex flex-wrap items-center gap-3 rounded bg-broadcast-fg/5 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-bold uppercase tracking-wide">{s.name}</p>
              <p className="text-sm text-broadcast-fg/70">{s.description}</p>
              <p className="mt-1 font-mono text-xs break-all text-broadcast-fg/70">{url}</p>
            </div>
            <button
              type="button"
              className="min-h-11 rounded bg-broadcast-accent px-4 text-sm font-bold uppercase tracking-wide text-broadcast-fg"
              onClick={async () => {
                await navigator.clipboard.writeText(url);
                setCopied(s.slug);
                setTimeout(() => setCopied((c) => (c === s.slug ? null : c)), 2000);
              }}
            >
              {copied === s.slug ? "Copied" : "Copy URL"}
            </button>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center rounded border border-broadcast-fg/30 px-4 text-sm font-bold uppercase tracking-wide"
            >
              Preview<span className="sr-only"> {s.name} (opens in a new tab)</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
```

`OverlayLinks.test.tsx`: mock `navigator.clipboard.writeText`. Clicking the Program row's Copy button calls it with `https://x.test/overlay/f-1/program` (pass `origin="https://x.test"`), and the button then reads "Copied".

**Index `page.tsx`** (server):
- Builds `origin` from `headers()`, as the athlete page builds `checkinUrl`.
- Keeps the dark operator surface: `min-h-screen bg-broadcast-bg p-10 text-broadcast-fg`.
- Shows `h1` `Overlay URLs — {eventName}`, then the callout paragraph (exact copy) in a bordered box with an accent left border.
- Renders `<OverlayLinks>` with `SOURCES`, Program first:
  - **Program:** Everything Production puts on air — cards, clock, lower third. Use this one in YoloBox.
  - **Timer:** The running clock, top right.
  - **Heat:** The heat strip, top left.
  - **Lanes:** The lanes in this heat.
  - **Leaderboard:** The division's overall standings.
  - **Lower third:** The athlete name strip.
  - **WOD:** The workout card.
  - **Sponsor:** The sponsor card.
- Ends with a link to `/overlay/{floorId}/test`: "Check the picture on your device", as a `min-h-11` link.

**Calibration `test/page.tsx`:**
- Server: `notFound()` if the floor doesn't exist, using `getFloorContext`.
- Renders `<BroadcastStage>`:
  - a full-stage `absolute inset-0 border-2 border-broadcast-fg` outline;
  - `<SafeArea className="border-2 border-dashed border-broadcast-accent">`;
  - corner labels TL, TR, BL and BR inside the safe area (`text-bc-label`, bold);
  - a centred panel (`bg-broadcast-bg/80 px-[48px] py-[32px] text-center`) holding the title "1920 × 1080 stage", `<CalibrationReadout/>` and the transparency sentence (exact copy).
- No page background.

`CalibrationReadout` (client) shows `Viewport {innerWidth} × {innerHeight} · scale {stageScale(...).toFixed(3)}` and updates on resize.

- [ ] **Steps:**
  1. Write the `OverlayLinks` test and confirm it fails.
  2. Implement everything above.
  3. Run `pnpm vitest run "src/app/(overlay)" && pnpm check`.
  4. Commit with the title "Every overlay sits in the safe area, and the operator gets copyable URLs and a calibration page".

---

### Task 5: DESIGN.md, browser verification, final review and PR

- [ ] **DESIGN.md:** rewrite the "Broadcast graphics (overlays)" subsection to cover:
  - the 1920×1080 stage and `BroadcastStage`;
  - `SafeArea` (96/54);
  - the `text-bc-*` scale;
  - `Appear` (variants, `EXIT_MS`, transform and opacity only, reduced motion);
  - the timer as a corner clock in Program;
  - YoloBox: one Program URL, calibrated with `/overlay/{floorId}/test`.

  Keep the existing "never shadcn in overlays" rule.
- [ ] **Browser run** (`.verify/overlays/`). Set `broadcast_state` through SQL on floor `00000000-0000-0000-0000-000000000030`: `current_heat_id` = the seeded heat, `active_graphic` and `lower_third_athlete_id`, with the timer started through a `timer_status='running'` update and an anchor.
  1. Program at 1920×1080 and 1280×720 in these states:
     - timer (screenshots `program-timer-1920.png` and `program-timer-1280.png`);
     - lanes plus a lower third (`program-lanes-lt-1280.png`);
     - leaderboard;
     - none.
  2. In each state, a script checks that every element with `[data-appear]` has a rect inside the viewport, and that the corner elements sit at least `96*s` / `54*s` from the edges.
  3. Check that the computed background of `html` and `body` is `rgba(0, 0, 0, 0)`.
  4. Take the calibration page at 1280×720 (`calibration-1280.png`) and the index (`index.png`), and copy a URL.
  5. Toggle the lower third through SQL and capture `data-appear="in"` / `"out"` evidence.
  6. Reset `broadcast_state` to idle and none, and close the pages.
- [ ] **Final review:** run one whole-branch review on the most capable model, and fix Critical and Important findings test-first.
- [ ] **PR:** run `gh pr create --base staging`. The body includes the YoloBox context and the sources. Stop at the link.
