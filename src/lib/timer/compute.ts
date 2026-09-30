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

/**
 * The first frame, computed at the anchor itself rather than at Date.now():
 * a pure function of the timer state, so the server render and the browser's
 * hydration produce identical text. The live tick takes over right after.
 */
export function initialTimerDisplay(timer: TimerState): TimerDisplay {
  return computeTimerDisplay(timer, timer.anchorTimeMs ?? 0);
}

/**
 * How far the server's clock is ahead of this machine's (negative = behind),
 * from one round trip: the server read its clock roughly halfway between the
 * request leaving and the response arriving. Add it to Date.now() to get
 * server time, so an OBS PC with a skewed clock still shows the right timer.
 */
export function estimateClockOffsetMs(
  requestStartMs: number,
  serverNowMs: number,
  responseEndMs: number,
): number {
  return serverNowMs - (requestStartMs + responseEndMs) / 2;
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/**
 * Inverse of formatClock, for judge-facing time entry (Score Keeper / Admin
 * results forms). A judge's scorecard reads "3:45", not "225" — this lets the
 * field accept what's actually written on paper, plus a couple of tolerant
 * fallbacks (bare seconds, "m:ss.ms") rather than forcing one exact format.
 *
 * Accepted forms: "3:45", "3:45.5", "0:09", "225", "225.5". Whitespace is
 * trimmed. Anything else (empty, garbage, negative) returns null so callers
 * can treat it the same as "left blank."
 */
export function parseClockToSeconds(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;

  const colonMatch = trimmed.match(/^(\d+):([0-5]?\d)(?:\.(\d+))?$/);
  if (colonMatch) {
    const minutes = Number(colonMatch[1]);
    const seconds = Number(colonMatch[2]);
    const fraction = colonMatch[3] ? Number(`0.${colonMatch[3]}`) : 0;
    return minutes * 60 + seconds + fraction;
  }

  // No colon — treat as plain seconds (keeps old "225" entries working).
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  return null;
}
