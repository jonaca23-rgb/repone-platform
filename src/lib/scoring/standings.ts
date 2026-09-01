import type { RankedResult, StandingEntry } from "./types";

/**
 * Aggregates per-WOD ranked results into overall standings for a division.
 * Lower total points wins (consistent with rankWodResults awarding placement-as-points).
 * A competitor missing a WOD entirely (no result row at all) is treated as if they
 * scored last place + 1 for that WOD once `fieldSizeByWod` is supplied — pass an empty
 * map to simply omit missing WODs from the total instead.
 */
export function computeOverallStandings(
  perWodRanked: Array<{ wodId: string; results: RankedResult[] }>,
  options?: { fieldSizeByWod?: Record<string, number> }
): StandingEntry[] {
  const totals = new Map<string, StandingEntry>();

  for (const { wodId, results } of perWodRanked) {
    for (const r of results) {
      const entry = totals.get(r.competitorId) ?? {
        competitorId: r.competitorId,
        totalPoints: 0,
        placements: [],
        overallPlacement: null,
      };
      entry.placements.push({ wodId, placement: r.placement, points: r.wodPoints });
      entry.totalPoints += r.wodPoints ?? (options?.fieldSizeByWod?.[wodId] ?? 0) + 1;
      totals.set(r.competitorId, entry);
    }
  }

  const entries = Array.from(totals.values());
  entries.sort((a, b) => a.totalPoints - b.totalPoints);

  let place = 0;
  let seen = 0;
  let prevTotal: number | null = null;
  for (const e of entries) {
    seen += 1;
    if (prevTotal === null || e.totalPoints !== prevTotal) {
      place = seen;
    }
    e.overallPlacement = place;
    prevTotal = e.totalPoints;
  }

  return entries;
}
