"use client";

import { Appear } from "@/components/graphics/Appear";
import { BroadcastStage, SafeArea } from "@/components/graphics/BroadcastStage";
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
  return (
    <BroadcastStage>
      <SafeArea>
        <Appear show={!!currentHeat} variant="rise" className="absolute top-[120px] left-0">
          {currentHeat && (
            <LanesBoard
              lanes={currentHeat.lanes.map((l) => ({
                laneNumber: l.laneNumber,
                name: l.name,
                affiliate: l.affiliate,
              }))}
            />
          )}
        </Appear>
      </SafeArea>
    </BroadcastStage>
  );
}
