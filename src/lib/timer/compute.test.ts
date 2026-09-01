import { describe, expect, it } from "vitest";
import { computeTimerDisplay, formatClock, type TimerState } from "./compute";

describe("computeTimerDisplay — count_down", () => {
  it("counts down from duration and reaches zero at the cap", () => {
    const anchor = 1_000_000;
    const timer: TimerState = {
      status: "running",
      direction: "count_down",
      durationSeconds: 900,
      elapsedAtAnchor: 0,
      anchorTimeMs: anchor,
    };
    expect(computeTimerDisplay(timer, anchor).displaySeconds).toBe(900);
    expect(computeTimerDisplay(timer, anchor + 60_000).displaySeconds).toBe(840);
    const atCap = computeTimerDisplay(timer, anchor + 900_000);
    expect(atCap.displaySeconds).toBe(0);
    expect(atCap.atLimit).toBe(true);
    // running well past the cap never goes negative
    expect(computeTimerDisplay(timer, anchor + 999_000).displaySeconds).toBe(0);
  });

  it("a paused timer shows the banked value regardless of wall-clock time", () => {
    const timer: TimerState = {
      status: "paused",
      direction: "count_down",
      durationSeconds: 900,
      elapsedAtAnchor: 300, // 5 minutes elapsed when paused
      anchorTimeMs: 1_000_000,
    };
    expect(computeTimerDisplay(timer, 1_000_000).displaySeconds).toBe(600);
    expect(computeTimerDisplay(timer, 9_999_999).displaySeconds).toBe(600);
  });

  it("a client that reconnects late recomputes the same value from the anchor (no drift)", () => {
    const anchor = 5_000_000;
    const timer: TimerState = {
      status: "running",
      direction: "count_down",
      durationSeconds: 600,
      elapsedAtAnchor: 0,
      anchorTimeMs: anchor,
    };
    // "dashboard" checks in real time...
    const dashboardView = computeTimerDisplay(timer, anchor + 45_000);
    // ...an overlay that just reconnected 45s later computes from the same anchor
    const overlayView = computeTimerDisplay(timer, anchor + 45_000);
    expect(overlayView.displaySeconds).toBe(dashboardView.displaySeconds);
  });
});

describe("computeTimerDisplay — count_up", () => {
  it("counts up and caps display at duration when a cap is set", () => {
    const anchor = 0;
    const timer: TimerState = {
      status: "running",
      direction: "count_up",
      durationSeconds: 720, // 12:00 AMRAP cap
      elapsedAtAnchor: 0,
      anchorTimeMs: anchor,
    };
    expect(computeTimerDisplay(timer, 60_000).displaySeconds).toBe(60);
    const atCap = computeTimerDisplay(timer, 720_000);
    expect(atCap.displaySeconds).toBe(720);
    expect(atCap.atLimit).toBe(true);
    expect(computeTimerDisplay(timer, 800_000).displaySeconds).toBe(720);
  });

  it("counts up uncapped when duration is 0", () => {
    const timer: TimerState = {
      status: "running",
      direction: "count_up",
      durationSeconds: 0,
      elapsedAtAnchor: 0,
      anchorTimeMs: 0,
    };
    expect(computeTimerDisplay(timer, 1_000_000).displaySeconds).toBe(1000);
    expect(computeTimerDisplay(timer, 1_000_000).atLimit).toBe(false);
  });
});

describe("formatClock", () => {
  it("formats mm:ss with zero-padding", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(65)).toBe("01:05");
    expect(formatClock(900)).toBe("15:00");
  });
});
