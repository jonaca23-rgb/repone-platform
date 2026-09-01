"use client";

import { useBroadcastState } from "@/lib/realtime/useBroadcastState";
import { useLiveTimer } from "@/lib/realtime/useLiveTimer";
import { TimerDisplay } from "@/components/graphics/TimerDisplay";
import type { Database } from "@/lib/db/database.types";

type BroadcastStateRow = Database["public"]["Tables"]["broadcast_state"]["Row"];

export function TimerOverlayClient({
  floorId,
  initialBroadcastState,
}: {
  floorId: string;
  initialBroadcastState: BroadcastStateRow | null;
}) {
  const { state } = useBroadcastState(floorId, initialBroadcastState);
  const timer = useLiveTimer({
    status: state?.timer_status ?? "idle",
    direction: state?.timer_direction ?? "count_down",
    durationSeconds: state?.timer_duration_seconds ?? 0,
    elapsedAtAnchor: state?.timer_elapsed_at_anchor ?? 0,
    anchorTimeMs: state?.timer_anchor_time ? new Date(state.timer_anchor_time).getTime() : null,
  });

  return (
    <div className="flex h-screen w-screen items-start justify-end p-8">
      <TimerDisplay seconds={timer.displaySeconds} atLimit={timer.atLimit} />
    </div>
  );
}
