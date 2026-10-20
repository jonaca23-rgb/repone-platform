"use client";

import { Appear } from "@/components/graphics/Appear";
import { BroadcastStage, SafeArea } from "@/components/graphics/BroadcastStage";
import { useFloorOverlay } from "@/lib/realtime/useFloorOverlay";
import { useStandings } from "@/lib/realtime/useStandings";
import { Leaderboard } from "@/components/graphics/Leaderboard";
import type { FloorHeat } from "@/lib/db/queries";
import type { Database } from "@/lib/db/database.types";

type BroadcastStateRow = Database["public"]["Tables"]["broadcast_state"]["Row"];

// Standalone, always-on overall leaderboard for whatever division the
// current heat belongs to — independent of the Program overlay's toggle.
export function LeaderboardOverlayClient({
  floorId,
  heats,
  initialBroadcastState,
}: {
  floorId: string;
  heats: FloorHeat[];
  initialBroadcastState: BroadcastStateRow | null;
}) {
  const { currentHeat } = useFloorOverlay(floorId, initialBroadcastState, heats);
  const standings = useStandings(currentHeat?.division.id ?? null);

  return (
    <BroadcastStage>
      <SafeArea>
        <Appear
          show={!!currentHeat}
          variant="rise"
          className="absolute top-1/2 right-0 -translate-y-1/2"
        >
          {currentHeat && (
            <Leaderboard
              title={`${currentHeat.division.name} — Overall`}
              rows={standings.map((s) => ({
                placement: s.placement,
                name: s.name,
                value: `${s.points ?? "—"} pts`,
              }))}
            />
          )}
        </Appear>
      </SafeArea>
    </BroadcastStage>
  );
}
