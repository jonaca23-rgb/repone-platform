"use client";

import { useMemo, useState } from "react";
import type { LaneResult, ScoringLane, ScoringType } from "@/lib/scoring/format";
import { LaneList, resultsByCompetitor } from "./LaneList";
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
  const byCompetitor = useMemo(() => resultsByCompetitor(results), [results]);
  return (
    <>
      <LaneList
        lanes={lanes}
        resultsByCompetitor={byCompetitor}
        scoringType={scoringType}
        onOpen={setOpen}
      />
      <ScoreDrawer
        key={open ? `${heatId}:${open.competitorId}` : "closed"}
        heatId={heatId}
        lane={open}
        existing={open ? byCompetitor.get(open.competitorId) : undefined}
        scoringType={scoringType}
        subtitle={subtitle}
        onClose={() => setOpen(null)}
      />
    </>
  );
}
