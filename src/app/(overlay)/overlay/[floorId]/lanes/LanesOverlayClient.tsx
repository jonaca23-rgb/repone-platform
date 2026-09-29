"use client";

import { useFloorOverlay } from "@/lib/realtime/useFloorOverlay";
import { LanesBoard } from "@/components/graphics/LanesBoard";
import type { FloorHeat } from "@/lib/db/queries";
import type { Database } from "@/lib/db/database.types";

type BroadcastStateRow = Database["public"]["Tables"]["broadcast_state"]["Row"];

export function LanesOverlayClient({
  floorId,
  heats,
  initialBroadcastState,
}: {
  floorId: string;
  heats: FloorHeat[];
  initialBroadcastState: BroadcastStateRow | null;
}) {
  const { currentHeat } = useFloorOverlay(floorId, initialBroadcastState, heats);
  if (!currentHeat) return null;

  return (
    <div className="flex h-screen w-screen items-center justify-start p-8">
      <LanesBoard
        lanes={currentHeat.lanes.map((l) => ({
          laneNumber: l.laneNumber,
          name: l.name,
          affiliate: l.affiliate,
        }))}
      />
    </div>
  );
}
