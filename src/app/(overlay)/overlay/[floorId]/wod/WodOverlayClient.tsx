"use client";

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
  if (!currentHeat) return null;

  return (
    <div className="flex h-screen w-screen items-center justify-center p-8">
      <WodCard
        name={currentHeat.wod.name}
        description={currentHeat.wod.description}
        timeCapSeconds={currentHeat.wod.time_cap_seconds}
      />
    </div>
  );
}
