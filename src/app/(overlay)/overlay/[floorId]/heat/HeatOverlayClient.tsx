"use client";

import { Appear } from "@/components/graphics/Appear";
import { BroadcastStage, SafeArea } from "@/components/graphics/BroadcastStage";
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
  return (
    <BroadcastStage>
      <SafeArea>
        <Appear show={!!currentHeat} variant="fade" className="absolute top-0 left-0">
          {currentHeat && (
            <HeatIdentification
              wodName={currentHeat.wod.name}
              heatNumber={currentHeat.heatNumber}
              heatCount={currentHeat.heatCount}
              divisionName={currentHeat.division.name}
            />
          )}
        </Appear>
      </SafeArea>
    </BroadcastStage>
  );
}
