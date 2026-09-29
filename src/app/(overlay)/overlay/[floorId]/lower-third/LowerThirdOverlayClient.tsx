"use client";

import { useBroadcastState } from "@/lib/realtime/useBroadcastState";
import { useAthleteLookup } from "@/lib/realtime/useAthleteLookup";
import { LowerThird } from "@/components/graphics/LowerThird";
import type { Database } from "@/lib/db/database.types";

type BroadcastStateRow = Database["public"]["Tables"]["broadcast_state"]["Row"];

export function LowerThirdOverlayClient({
  floorId,
  eventId,
  initialBroadcastState,
}: {
  floorId: string;
  eventId: string;
  initialBroadcastState: BroadcastStateRow | null;
}) {
  const { state } = useBroadcastState(floorId, initialBroadcastState);
  const athlete = useAthleteLookup(state?.lower_third_athlete_id ?? null, eventId);

  if (!state?.lower_third_athlete_id || !athlete) return null;

  return (
    <LowerThird name={athlete.name} division={athlete.division} affiliate={athlete.affiliate} />
  );
}
