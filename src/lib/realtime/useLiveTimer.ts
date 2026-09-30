"use client";

import { useEffect, useState } from "react";
import {
  computeTimerDisplay,
  initialTimerDisplay,
  type TimerDisplay,
  type TimerState,
} from "@/lib/timer/compute";
import { useServerClockOffset } from "./useServerClockOffset";

/**
 * Ticks a locally-derived display value from a server-authoritative timer
 * state. Re-syncs from `timer` on every prop change (i.e. every Realtime
 * update from broadcast_state), so a dropped connection that reconnects
 * later snaps to the correct value instead of continuing to drift.
 *
 * "Now" is the server's clock (Date.now() + measured offset), because the
 * anchor is written by the database: a skewed OBS PC would otherwise show a
 * constant error. The first render uses initialTimerDisplay() so server and
 * browser agree during hydration.
 */
export function useLiveTimer(timer: TimerState): TimerDisplay {
  const offsetMs = useServerClockOffset();
  const [display, setDisplay] = useState<TimerDisplay>(() => initialTimerDisplay(timer));

  useEffect(() => {
    const serverNow = () => Date.now() + offsetMs;
    // Re-sync immediately whenever the server-authoritative timer prop changes
    // (e.g. a Realtime update), rather than waiting for the next 200ms tick.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDisplay(computeTimerDisplay(timer, serverNow()));
    if (timer.status !== "running") return;

    const id = setInterval(() => {
      setDisplay(computeTimerDisplay(timer, serverNow()));
    }, 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    offsetMs,
    timer.status,
    timer.direction,
    timer.durationSeconds,
    timer.elapsedAtAnchor,
    timer.anchorTimeMs,
  ]);

  return display;
}
