import type { StandingEntry } from "./types";

export interface WodResultsForStandings {
  wodId: string;
  results: Array<{ competitorId: string; placement: number | null; wodPoints: number | null }>;
  /**
   * Every heat of this WOD in the division has finished. Only then does a
   * competitor with no result at all count as last: while the WOD is still
   * running, they may simply not have reached their heat yet.
   */
  complete?: boolean;
}

/**
 * Aggregates per-WOD ranked results into overall standings for a division.
 * Lower total points wins (rankWodResults awards placement-as-points).
 *
 * A competitor who didn't finish a WOD (dns/dnf/dq, so no points) scores one
 * place after that WOD's last finisher: finishers + 1. So does a competitor
 * with no result in a WOD that is `complete`. Pass `competitorIds` (everyone
 * registered in the division) so competitors with no result row at all are
 * included; anyone with no counted WOD yet is left off the board.
 */
export function computeOverallStandings(
  perWodRanked: WodResultsForStandings[],
  options?: { competitorIds?: string[] },
): StandingEntry[] {
  const competitorIds = new Set(options?.competitorIds ?? []);
  for (const { results } of perWodRanked) {
    for (const r of results) competitorIds.add(r.competitorId);
  }

  const totals = new Map<string, StandingEntry>();

  for (const { wodId, results, complete } of perWodRanked) {
    const byCompetitor = new Map(results.map((r) => [r.competitorId, r]));
    const finishers = results.filter((r) => r.wodPoints !== null).length;
    const pointsAfterLastFinisher = finishers + 1;

    for (const competitorId of competitorIds) {
      const result = byCompetitor.get(competitorId);
      if (!result && !complete) continue;

      const entry = totals.get(competitorId) ?? {
        competitorId,
        totalPoints: 0,
        placements: [],
        overallPlacement: null,
      };
      entry.placements.push({
        wodId,
        placement: result?.placement ?? null,
        points: result?.wodPoints ?? null,
      });
      entry.totalPoints += result?.wodPoints ?? pointsAfterLastFinisher;
      totals.set(competitorId, entry);
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
