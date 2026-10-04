"use client";

import { useMemo, useState } from "react";
import type { LaneResult, ScoringLane, ScoringType } from "@/lib/scoring/format";
import { LaneList, resultsByAthlete } from "./LaneList";
import { ScoreDrawer } from "./ScoreDrawer";

/** The lane list with its score drawer, for a page that only enters results (admin Results tab). */
export function LaneScoring({
  heatId,
  lanes,
  results,
  scoringType,
  subtitle,
}: {
  heatId: string;
  lanes: ScoringLane[];
  results: LaneResult[];
  scoringType: ScoringType;
  subtitle: string;
}) {
  const [open, setOpen] = useState<ScoringLane | null>(null);
  const byAthlete = useMemo(() => resultsByAthlete(results), [results]);
  return (
    <>
      <LaneList
        lanes={lanes}
        resultsByAthlete={byAthlete}
        scoringType={scoringType}
        onOpen={setOpen}
      />
      <ScoreDrawer
        key={open ? `${heatId}:${open.athleteId}` : "closed"}
        heatId={heatId}
        lane={open}
        existing={open ? byAthlete.get(open.athleteId) : undefined}
        scoringType={scoringType}
        subtitle={subtitle}
        onClose={() => setOpen(null)}
      />
    </>
  );
}
