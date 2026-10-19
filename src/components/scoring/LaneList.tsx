import { Check, CircleDashed, PencilLine } from "lucide-react";
import {
  type LaneResult,
  type ScoringLane,
  type ScoringType,
  scoreSummary,
} from "@/lib/scoring/format";
import { Badge } from "@/components/ui/badge";

const BADGE = {
  recorded: {
    label: "Recorded",
    icon: Check,
    className: "border-success/40 bg-success/10 text-success-text",
  },
  adjusted: {
    label: "Adjusted",
    icon: PencilLine,
    className: "border-warning/40 bg-warning/10 text-warning-text",
  },
  pending: { label: "Pending", icon: CircleDashed, className: "text-muted-foreground" },
} as const;

/** Saved results by who they are for: the athlete's or the team's id. */
export function resultsByCompetitor(results: LaneResult[]): Map<string, LaneResult> {
  const map = new Map<string, LaneResult>();
  for (const r of results) {
    const id = r.athlete_id ?? r.team_id;
    if (id) map.set(id, r);
  }
  return map;
}

/**
 * The heat's laned athletes, one row each: lane, name, score, state. With
 * `onOpen` a row is a button that opens its score drawer; without it the list
 * is read-only (a finished heat, for anyone but an organizer).
 */
export function LaneList({
  lanes,
  resultsByCompetitor: results,
  scoringType,
  onOpen,
}: {
  lanes: ScoringLane[];
  resultsByCompetitor: Map<string, LaneResult>;
  scoringType: ScoringType;
  onOpen?: (lane: ScoringLane) => void;
}) {
  return (
    <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {lanes.map((lane) => {
        const result = results.get(lane.competitorId);
        const state = !result ? "pending" : result.manually_adjusted ? "adjusted" : "recorded";
        const badge = BADGE[state];
        const Icon = badge.icon;
        const row = (
          <>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary font-display text-lg font-bold text-primary-foreground">
              {lane.laneNumber}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{lane.name}</span>
              {lane.affiliate ? (
                <span className="block truncate text-sm text-muted-foreground">
                  {lane.affiliate}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 text-right">
              <span className="block font-display text-lg tabular-nums">
                {scoreSummary(result, scoringType)}
              </span>
              <Badge variant="outline" className={badge.className}>
                <Icon aria-hidden />
                {badge.label}
              </Badge>
            </span>
          </>
        );
        return (
          <li key={lane.laneNumber}>
            {onOpen ? (
              <button
                type="button"
                onClick={() => onOpen(lane)}
                aria-label={`Lane ${lane.laneNumber}, ${lane.name}: ${scoreSummary(result, scoringType)}, ${badge.label}`}
                className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-hidden"
              >
                {row}
              </button>
            ) : (
              <div className="flex min-h-14 w-full items-center gap-3 px-4 py-2">{row}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
