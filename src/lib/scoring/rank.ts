import type { RankedResult, RawResult, WodScoringConfig } from "./types";

/**
 * Returns a comparator value for two raw results under a given WOD's rules.
 * Negative => a ranks better than b. Does NOT handle dns/dnf/dq — callers filter those out first.
 */
function compareCompleted(a: RawResult, b: RawResult, config: WodScoringConfig): number {
  if (config.scoringType === "for_time") {
    const aCapped = !!a.capped;
    const bCapped = !!b.capped;
    // A capped result never beats a finisher.
    if (aCapped !== bCapped) return aCapped ? 1 : -1;
    if (aCapped && bCapped) {
      // Among capped results, more reps completed is better.
      const repsDiff = (b.reps ?? 0) - (a.reps ?? 0);
      if (repsDiff !== 0) return repsDiff;
      return tiebreak(a, b);
    }
    // Both finished within the cap: fastest time wins.
    return compareScores(a.timeSeconds, b.timeSeconds, "lower") || tiebreak(a, b);
  }

  if (config.scoringType === "amrap") {
    return compareScores(a.reps, b.reps, "higher") || tiebreak(a, b);
  }

  if (config.scoringType === "max_load") {
    return compareScores(a.load, b.load, "higher") || tiebreak(a, b);
  }

  // points / other
  return compareScores(a.points, b.points, "higher") || tiebreak(a, b);
}

/**
 * Compares two scores where a missing score (a "completed" lane saved blank)
 * ranks after any real score and ties with another missing one. Plain
 * subtraction would compute Infinity - Infinity = NaN for two blanks, which
 * leaves Array.sort's order undefined.
 */
function compareScores(
  a: number | null | undefined,
  b: number | null | undefined,
  better: "lower" | "higher",
): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return better === "lower" ? a - b : b - a;
}

/** Tie-break values are always "lower is better" (typically a time). */
function tiebreak(a: RawResult, b: RawResult): number {
  return compareScores(a.tiebreakValue, b.tiebreakValue, "lower");
}

/**
 * Ranks all results for a single heat/WOD combination.
 * - Completed results are ordered by the WOD's scoring rules, then tie-break.
 * - dns/dnf/dq always rank after all completed results (placement = null).
 * - Uses standard competition ranking (1, 2, 2, 4 — ties share a place, next
 *   placement skips accordingly), and awards WOD points equal to the placement
 *   number (lower total is better across the event — swap this mapping in one
 *   place if a different points table is needed later).
 */
export function rankWodResults(results: RawResult[], config: WodScoringConfig): RankedResult[] {
  const completed = results.filter((r) => (r.status ?? "completed") === "completed");
  const notCompleted = results.filter((r) => (r.status ?? "completed") !== "completed");

  completed.sort((a, b) => compareCompleted(a, b, config));

  const ranked: RankedResult[] = [];
  let place = 0;
  let seen = 0;
  let prev: RawResult | null = null;

  for (const r of completed) {
    seen += 1;
    if (prev === null || compareCompleted(prev, r, config) !== 0) {
      place = seen;
    }
    ranked.push({ ...r, placement: place, wodPoints: place });
    prev = r;
  }

  for (const r of notCompleted) {
    ranked.push({ ...r, placement: null, wodPoints: null });
  }

  return ranked;
}
