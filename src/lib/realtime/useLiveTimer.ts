"use client";

import { useEffect, useState } from "react";
import { computeTimerDisplay, type TimerDisplay, type TimerState } from "@/lib/timer/compute";

/**
 * Ticks a locally-derived display value from a server-authoritative timer
 * state. Re-syncs from `timer` on every prop change (i.e. every Realtime
 * update from broadcast_state), so a dropped connection that reconnects
 * later snaps to the correct value instead of continuing to drift.
 */
export function useLiveTimer(timer: TimerState): TimerDisplay {
  const [display, setDisplay] = useState<TimerDisplay>(() => computeTimerDisplay(timer, Date.now()));

  useEffect(() => {
    // Re-sync immediately whenever the server-authoritative timer prop changes
    // (e.g. a Realtime update), rather than waiting for the next 200ms tick.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDisplay(computeTimerDisplay(timer, Date.now()));
    if (timer.status !== "running") return;

    const id = setInterval(() => {
      setDisplay(computeTimerDisplay(timer, Date.now()));
    }, 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer.status, timer.direction, timer.durationSeconds, timer.elapsedAtAnchor, timer.anchorTimeMs]);

  return display;
}
