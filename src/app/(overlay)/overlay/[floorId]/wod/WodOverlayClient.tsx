"use client";

import { Appear } from "@/components/graphics/Appear";
import { BroadcastStage, SafeArea } from "@/components/graphics/BroadcastStage";
import { useFloorOverlay } from "@/lib/realtime/useFloorOverlay";
import { WodCard } from "@/components/graphics/WodCard";
import type { FloorHeat } from "@/lib/db/queries";
import type { Database } from "@/lib/db/database.types";

type BroadcastStateRow = Database["public"]["Tables"]["broadcast_state"]["Row"];

export function WodOverlayClient({
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
        <Appear
          show={!!currentHeat}
          variant="rise"
          className="absolute top-1/2 left-0 -translate-y-1/2"
        >
          {currentHeat && (
            <WodCard
              name={currentHeat.wod.name}
              description={currentHeat.wod.description}
              timeCapSeconds={currentHeat.wod.time_cap_seconds}
            />
          )}
        </Appear>
      </SafeArea>
    </BroadcastStage>
  );
}
