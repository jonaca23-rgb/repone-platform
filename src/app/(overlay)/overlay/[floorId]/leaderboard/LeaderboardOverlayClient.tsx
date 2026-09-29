"use client";

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

  if (!currentHeat) return null;

  return (
    <div className="flex h-screen w-screen items-center justify-end p-8">
      <Leaderboard
        title={`${currentHeat.division.name} — Overall`}
        rows={standings.map((s) => ({
          placement: s.placement,
          name: s.name,
          value: `${s.points ?? "—"} pts`,
        }))}
      />
    </div>
  );
}
