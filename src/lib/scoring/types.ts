// Domain types for the scoring engine.
// IMPORTANT: this module has zero UI or DB imports. It is pure computation so it can be
// unit-tested in isolation and reused from server actions, edge functions, or scripts.

export type ScoringType = "for_time" | "amrap" | "max_load" | "points" | "other";
export type TiebreakType = "none" | "time" | "reps" | "load" | "points";

export interface WodScoringConfig {
  id: string;
  scoringType: ScoringType;
  timeCapSeconds: number | null;
  tiebreakType: TiebreakType;
  /** true for for_time (fastest wins); false for amrap/max_load/points (highest wins) */
  lowerIsBetter: boolean;
}

/**
 * The RAW result for one competitor in one heat, exactly as entered.
 * Only the field(s) matching the WOD's scoring_type should be populated —
 * this mirrors the `results` table and is intentionally NOT a single generic score.
 */
export interface RawResult {
  competitorId: string; // athlete_id or team_id
  timeSeconds?: number | null; // for_time
  reps?: number | null; // amrap, or reps-completed-if-capped for for_time
  load?: number | null; // max_load
  points?: number | null; // points
  capped?: boolean; // true if a for_time result hit the time cap
  tiebreakValue?: number | null;
  /** competitor did not start / did not finish / was disqualified — always ranks last */
  status?: "completed" | "dns" | "dnf" | "dq";
}

export interface RankedResult extends RawResult {
  placement: number | null; // null only for dns/dnf/dq
  wodPoints: number | null; // points awarded for this WOD based on placement
}

export interface StandingEntry {
  competitorId: string;
  totalPoints: number;
  placements: Array<{ wodId: string; placement: number | null; points: number | null }>;
  overallPlacement: number | null;
}
