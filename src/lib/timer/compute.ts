// Pure, framework-free timer math shared by the Production Dashboard and every
// broadcast overlay. Nothing here owns a "ticking" timer of its own — every
// client derives the current value from the same server-authoritative anchor,
// so a dashboard and an overlay (or an overlay that just reconnected after a
// dropped connection) always compute the identical number instead of drifting.

export interface TimerState {
  status: "idle" | "running" | "paused" | "ended";
  direction: "count_up" | "count_down";
  durationSeconds: number;
  /** seconds of elapsed time already "banked" as of anchorTimeMs (0 if never started) */
  elapsedAtAnchor: number;
  /** wall-clock time (ms since epoch) the state above was last written; null if idle/paused with no anchor */
  anchorTimeMs: number | null;
}

export interface TimerDisplay {
  elapsedSeconds: number;
  remainingSeconds: number;
  /** the number this timer's face should show, already respecting direction */
  displaySeconds: number;
  /** count_down hit zero, or count_up hit its duration cap (0 = uncapped) */
  atLimit: boolean;
}

export function computeElapsedSeconds(timer: TimerState, nowMs: number): number {
  if (timer.status === "running" && timer.anchorTimeMs !== null) {
    return timer.elapsedAtAnchor + Math.max(0, nowMs - timer.anchorTimeMs) / 1000;
  }
  return timer.elapsedAtAnchor;
}

export function computeTimerDisplay(timer: TimerState, nowMs: number): TimerDisplay {
  const elapsedSeconds = computeElapsedSeconds(timer, nowMs);
  const hasCap = timer.durationSeconds > 0;

  if (timer.direction === "count_down") {
    const remaining = hasCap ? Math.max(0, timer.durationSeconds - elapsedSeconds) : 0;
    return {
      elapsedSeconds,
      remainingSeconds: remaining,
      displaySeconds: remaining,
      atLimit: hasCap && remaining <= 0,
    };
  }

  // count_up
  const capped = hasCap ? Math.min(elapsedSeconds, timer.durationSeconds) : elapsedSeconds;
  return {
    elapsedSeconds,
    remainingSeconds: hasCap ? Math.max(0, timer.durationSeconds - elapsedSeconds) : 0,
    displaySeconds: capped,
    atLimit: hasCap && elapsedSeconds >= timer.durationSeconds,
  };
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
