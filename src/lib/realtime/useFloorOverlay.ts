"use client";

import { useMemo } from "react";
import { useBroadcastState } from "./useBroadcastState";
import { floorWatches } from "./floorWatches";
import { useRefreshOnChanges } from "./useRefreshOnChanges";
import type { FloorHeat } from "@/lib/db/queries";
import type { Database } from "@/lib/db/database.types";

type BroadcastStateRow = Database["public"]["Tables"]["broadcast_state"]["Row"];

/**
 * Shared by every overlay page: subscribes to this floor's broadcast_state
 * and resolves it against the (already-loaded) heat list so each overlay
 * only has to render, never re-derive "what heat/lane/wod is this."
 */
export function useFloorOverlay(
  floorId: string,
  initialState: BroadcastStateRow | null,
  heats: FloorHeat[],
) {
  const { state, connected } = useBroadcastState(floorId, initialState);
  // Heats and lanes are loaded once by the page; refresh when they change so
  // an OBS source shows a reassigned lane or a new heat without a reload.
  useRefreshOnChanges(
    floorWatches(
      floorId,
      heats.map((h) => h.id),
    ),
  );

  const currentHeat = useMemo(
    () => heats.find((h) => h.id === state?.current_heat_id) ?? null,
    [heats, state?.current_heat_id],
  );

  return { state, connected, currentHeat };
}
