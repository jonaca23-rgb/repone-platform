"use client";

import { Appear } from "@/components/graphics/Appear";
import { BroadcastStage, SafeArea } from "@/components/graphics/BroadcastStage";
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

  return (
    <BroadcastStage>
      <SafeArea>
        <Appear
          show={!!state?.lower_third_athlete_id && !!athlete}
          variant="slide-left"
          className="absolute bottom-0 left-0"
        >
          {athlete && (
            <LowerThird
              name={athlete.name}
              division={athlete.division}
              affiliate={athlete.affiliate}
            />
          )}
        </Appear>
      </SafeArea>
    </BroadcastStage>
  );
}
