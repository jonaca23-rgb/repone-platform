"use client";

import { useFloorOverlay } from "@/lib/realtime/useFloorOverlay";
import { HeatIdentification } from "@/components/graphics/HeatIdentification";
import type { FloorHeat } from "@/lib/db/queries";
import type { Database } from "@/lib/db/database.types";

type BroadcastStateRow = Database["public"]["Tables"]["broadcast_state"]["Row"];

// Persistent "ID bug" — always shows the current heat, independent of the
// Program overlay's active_graphic toggle. Good as a corner strip layer.
export function HeatOverlayClient({
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
    <div className="flex h-screen w-screen items-start justify-start p-8">
      <HeatIdentification
        wodName={currentHeat.wod.name}
        heatNumber={currentHeat.heatNumber}
        heatCount={currentHeat.heatCount}
        divisionName={currentHeat.division.name}
      />
    </div>
  );
}
