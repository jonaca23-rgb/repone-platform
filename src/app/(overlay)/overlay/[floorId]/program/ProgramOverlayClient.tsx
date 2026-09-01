"use client";

import { useFloorOverlay } from "@/lib/realtime/useFloorOverlay";
import { useLiveTimer } from "@/lib/realtime/useLiveTimer";
import { useStandings } from "@/lib/realtime/useStandings";
import { useAthleteLookup } from "@/lib/realtime/useAthleteLookup";
import { HeatIdentification } from "@/components/graphics/HeatIdentification";
import { LanesBoard } from "@/components/graphics/LanesBoard";
import { WodCard } from "@/components/graphics/WodCard";
import { TimerDisplay } from "@/components/graphics/TimerDisplay";
import { Leaderboard } from "@/components/graphics/Leaderboard";
import { LowerThird } from "@/components/graphics/LowerThird";
import { SponsorCard } from "@/components/graphics/SponsorCard";
import { SPONSOR_TIER_LABELS } from "@/lib/constants/sponsors";
import type { FloorHeat } from "@/lib/db/queries";
import type { Database } from "@/lib/db/database.types";

type BroadcastStateRow = Database["public"]["Tables"]["broadcast_state"]["Row"];
type Sponsor = { id: string; business_name: string; logo_url: string | null; tier: string };

export function ProgramOverlayClient({
  floorId,
  eventId,
  heats,
  initialBroadcastState,
  sponsors,
}: {
  floorId: string;
  eventId: string;
  heats: FloorHeat[];
  initialBroadcastState: BroadcastStateRow | null;
  sponsors: Sponsor[];
}) {
  const { state, currentHeat } = useFloorOverlay(floorId, initialBroadcastState, heats);
  const timer = useLiveTimer({
    status: state?.timer_status ?? "idle",
    direction: state?.timer_direction ?? "count_down",
    durationSeconds: state?.timer_duration_seconds ?? 0,
    elapsedAtAnchor: state?.timer_elapsed_at_anchor ?? 0,
    anchorTimeMs: state?.timer_anchor_time ? new Date(state.timer_anchor_time).getTime() : null,
  });
  const standings = useStandings(state?.active_graphic === "leaderboard" ? currentHeat?.division.id ?? null : null);
  const lowerThirdAthlete = useAthleteLookup(state?.lower_third_athlete_id ?? null, eventId);
  const activeSponsor = sponsors.find((s) => s.id === state?.active_sponsor_id) ?? null;

  const graphic = state?.active_graphic ?? "none";

  return (
    <>
      {graphic === "heat_intro" && currentHeat && (
        <HeatIdentification
          wodName={currentHeat.wod.name}
          heatNumber={currentHeat.heatNumber}
          heatCount={currentHeat.heatCount}
          divisionName={currentHeat.division.name}
          fullScreen
        />
      )}
      {graphic === "lanes" && currentHeat && (
        <LanesBoard
          fullScreen
          lanes={currentHeat.lanes.map((l) => ({ laneNumber: l.laneNumber, name: l.name, affiliate: l.affiliate }))}
        />
      )}
      {graphic === "wod" && currentHeat && (
        <WodCard
          fullScreen
          name={currentHeat.wod.name}
          description={currentHeat.wod.description}
          timeCapSeconds={currentHeat.wod.time_cap_seconds}
        />
      )}
      {graphic === "timer" && <TimerDisplay fullScreen seconds={timer.displaySeconds} atLimit={timer.atLimit} />}
      {graphic === "leaderboard" && currentHeat && (
        <div className="flex h-screen w-screen items-center justify-center bg-repone-black">
          <Leaderboard
            title={`${currentHeat.division.name} — Overall`}
            rows={standings.map((s) => ({ placement: s.placement, name: s.name, value: `${s.points ?? "—"} pts` }))}
          />
        </div>
      )}
      {graphic === "sponsor" && activeSponsor && (
        <SponsorCard
          fullScreen
          businessName={activeSponsor.business_name}
          logoUrl={activeSponsor.logo_url}
          tierLabel={SPONSOR_TIER_LABELS[activeSponsor.tier as keyof typeof SPONSOR_TIER_LABELS]}
        />
      )}

      {/* Lower third renders as an overlay on top of whatever else is showing (or nothing). */}
      {state?.lower_third_athlete_id && lowerThirdAthlete && (
        <LowerThird
          name={lowerThirdAthlete.name}
          division={lowerThirdAthlete.division}
          affiliate={lowerThirdAthlete.affiliate}
        />
      )}
    </>
  );
}
