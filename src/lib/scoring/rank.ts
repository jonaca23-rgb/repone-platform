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
    const timeDiff = (a.timeSeconds ?? Infinity) - (b.timeSeconds ?? Infinity);
    if (timeDiff !== 0) return timeDiff;
    return tiebreak(a, b);
  }

  if (config.scoringType === "amrap") {
    const repsDiff = (b.reps ?? -Infinity) - (a.reps ?? -Infinity);
    if (repsDiff !== 0) return repsDiff;
    return tiebreak(a, b);
  }

  if (config.scoringType === "max_load") {
    const loadDiff = (b.load ?? -Infinity) - (a.load ?? -Infinity);
    if (loadDiff !== 0) return loadDiff;
    return tiebreak(a, b);
  }

  // points / other
  const pointsDiff = (b.points ?? -Infinity) - (a.points ?? -Infinity);
  if (pointsDiff !== 0) return pointsDiff;
  return tiebreak(a, b);
}

/** Tie-break values are always "lower is better" (typically a time). */
function tiebreak(a: RawResult, b: RawResult): number {
  const av = a.tiebreakValue ?? Infinity;
  const bv = b.tiebreakValue ?? Infinity;
  return av - bv;
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
