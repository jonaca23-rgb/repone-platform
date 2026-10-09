"use client";

import { useFloorOverlay } from "@/lib/realtime/useFloorOverlay";
import { useLiveTimer } from "@/lib/realtime/useLiveTimer";
import { useStandings } from "@/lib/realtime/useStandings";
import { useAthleteLookup } from "@/lib/realtime/useAthleteLookup";
import { useHeatResults } from "@/lib/realtime/useHeatResults";
import { HeatResults } from "@/components/graphics/HeatResults";
import { formatResult } from "@/lib/scoring/formatResult";
import type { ScoringType } from "@/lib/scoring/types";
import { HeatIdentification } from "@/components/graphics/HeatIdentification";
import { LanesBoard } from "@/components/graphics/LanesBoard";
import { WodCard } from "@/components/graphics/WodCard";
import { Appear } from "@/components/graphics/Appear";
import { BroadcastStage, SafeArea } from "@/components/graphics/BroadcastStage";
import { ClockBug } from "@/components/graphics/ClockBug";
import { Leaderboard } from "@/components/graphics/Leaderboard";
import { LowerThird } from "@/components/graphics/LowerThird";
import { SponsorCard } from "@/components/graphics/SponsorCard";
import type { FloorHeat } from "@/lib/db/queries";
import type { Database } from "@/lib/db/database.types";
import type { BroadcastSponsor } from "@/lib/db/sponsors";

type BroadcastStateRow = Database["public"]["Tables"]["broadcast_state"]["Row"];
type Sponsor = BroadcastSponsor;

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
  const standings = useStandings(
    state?.active_graphic === "leaderboard" ? (currentHeat?.division.id ?? null) : null,
  );
  const heatResults = useHeatResults(
    state?.active_graphic === "score" && currentHeat
      ? { id: currentHeat.id, wodId: currentHeat.wod.id, divisionId: currentHeat.division.id }
      : null,
  );
  const lowerThirdAthlete = useAthleteLookup(state?.lower_third_athlete_id ?? null, eventId);
  const activeSponsor = sponsors.find((s) => s.id === state?.active_sponsor_id) ?? null;

  const graphic = state?.active_graphic ?? "none";
  const heat = currentHeat;

  return (
    <BroadcastStage>
      {/* Cards fill the stage, one at a time: the old one leaves while the next comes in. */}
      <Appear show={graphic === "heat_intro" && !!heat} variant="rise" className="absolute inset-0">
        {heat && (
          <HeatIdentification
            wodName={heat.wod.name}
            heatNumber={heat.heatNumber}
            heatCount={heat.heatCount}
            divisionName={heat.division.name}
            fullScreen
          />
        )}
      </Appear>
      <Appear show={graphic === "lanes" && !!heat} variant="rise" className="absolute inset-0">
        {heat && (
          <LanesBoard
            fullScreen
            lanes={heat.lanes.map((l) => ({
              laneNumber: l.laneNumber,
              name: l.name,
              affiliate: l.affiliate,
            }))}
          />
        )}
      </Appear>
      <Appear show={graphic === "wod" && !!heat} variant="rise" className="absolute inset-0">
        {heat && (
          <WodCard
            fullScreen
            name={heat.wod.name}
            description={heat.wod.description}
            timeCapSeconds={heat.wod.time_cap_seconds}
          />
        )}
      </Appear>
      <Appear show={graphic === "score" && !!heat} variant="rise" className="absolute inset-0">
        {heat && (
          <HeatResults
            title={`${heat.wod.name} · Heat ${heat.heatNumber} — Results`}
            rows={heat.lanes.map((l) => {
              const r = l.athleteId ? heatResults.get(l.athleteId) : undefined;
              return {
                laneNumber: l.laneNumber,
                name: l.name ?? "—",
                value: formatResult(r?.result ?? null, heat.wod.scoring_type as ScoringType),
                placement: r?.placement ?? null,
              };
            })}
          />
        )}
      </Appear>
      <Appear
        show={graphic === "leaderboard" && !!heat}
        variant="rise"
        className="absolute inset-0"
      >
        {heat && (
          <Leaderboard
            fullScreen
            title={`${heat.division.name} — Overall`}
            rows={standings.map((s) => ({
              placement: s.placement,
              name: s.name,
              value: `${s.points ?? "—"} pts`,
            }))}
          />
        )}
      </Appear>
      <Appear
        show={graphic === "sponsor" && !!activeSponsor}
        variant="rise"
        className="absolute inset-0"
      >
        {activeSponsor && (
          <SponsorCard
            fullScreen
            businessName={activeSponsor.business_name}
            logoUrl={activeSponsor.logo_url}
            packageName={activeSponsor.packageName}
          />
        )}
      </Appear>

      <SafeArea>
        {/* The timer is corner bugs over live video, not a card. */}
        <Appear
          show={graphic === "timer" && !!heat}
          variant="fade"
          className="absolute top-0 left-0"
        >
          {heat && (
            <HeatIdentification
              wodName={heat.wod.name}
              heatNumber={heat.heatNumber}
              heatCount={heat.heatCount}
              divisionName={heat.division.name}
            />
          )}
        </Appear>
        <Appear show={graphic === "timer"} variant="fade" className="absolute top-0 right-0">
          <ClockBug seconds={timer.displaySeconds} atLimit={timer.atLimit} />
        </Appear>
        {/* The lower third goes over whatever else is on air, or over plain video. */}
        <Appear
          show={!!state?.lower_third_athlete_id && !!lowerThirdAthlete}
          variant="slide-left"
          className="absolute bottom-0 left-0"
        >
          {lowerThirdAthlete && (
            <LowerThird
              name={lowerThirdAthlete.name}
              division={lowerThirdAthlete.division}
              affiliate={lowerThirdAthlete.affiliate}
            />
          )}
        </Appear>
      </SafeArea>
    </BroadcastStage>
  );
}
