"use client";

import { Appear } from "@/components/graphics/Appear";
import { BroadcastStage, SafeArea } from "@/components/graphics/BroadcastStage";
import { useBroadcastState } from "@/lib/realtime/useBroadcastState";
import { SponsorCard } from "@/components/graphics/SponsorCard";
import { SPONSOR_TIER_LABELS } from "@/lib/constants/sponsors";
import type { Database } from "@/lib/db/database.types";

type BroadcastStateRow = Database["public"]["Tables"]["broadcast_state"]["Row"];
type Sponsor = { id: string; business_name: string; logo_url: string | null; tier: string };

export function SponsorOverlayClient({
  floorId,
  sponsors,
  initialBroadcastState,
}: {
  floorId: string;
  sponsors: Sponsor[];
  initialBroadcastState: BroadcastStateRow | null;
}) {
  const { state } = useBroadcastState(floorId, initialBroadcastState);
  const activeSponsor = sponsors.find((s) => s.id === state?.active_sponsor_id) ?? null;

  return (
    <BroadcastStage>
      <SafeArea>
        <Appear show={!!activeSponsor} variant="rise" className="absolute bottom-0 right-0">
          {activeSponsor && (
            <SponsorCard
              businessName={activeSponsor.business_name}
              logoUrl={activeSponsor.logo_url}
              tierLabel={
                SPONSOR_TIER_LABELS[activeSponsor.tier as keyof typeof SPONSOR_TIER_LABELS]
              }
            />
          )}
        </Appear>
      </SafeArea>
    </BroadcastStage>
  );
}
