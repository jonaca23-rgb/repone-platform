import { createClient } from "@/lib/db/server";
import { getAthleteLiftsAndBenchmarks, type LiftEntry, type BenchmarkEntry } from "@/lib/db/social";
import { getAthleteCompetitionHistory, type AthleteHistoryGroup } from "@/lib/db/messages";
import { computeAgeCategory, AGE_CATEGORY_LABELS, type Gender } from "@/lib/scoring/ageCategory";

// Everything the Commentator view needs about one athlete, beyond the
// name/affiliate/lane already carried on FloorHeat itself (see
// lib/db/queries.ts) — reuses the exact same lift/benchmark and
// competition-history lookups the athlete directory profile page already
// shows (lib/db/social.ts, lib/db/messages.ts), just without the "like"
// affordances, which don't make sense for a commentator looking at someone
// else's stats mid-broadcast.

export interface CommentatorAthleteDetails {
  ageCategoryLabel: string | null;
  lifts: LiftEntry[];
  benchmarks: BenchmarkEntry[];
  // Most recent events first (getAthleteCompetitionHistory already sorts
  // this way) — capped to a handful so the tablet screen doesn't force the
  // commentator to scroll mid-heat for an athlete with a long history.
  history: AthleteHistoryGroup[];
}

const MAX_HISTORY_EVENTS = 3;

/**
 * Batches the same per-athlete lookups the directory profile page uses,
 * for every athlete lane on a floor, keyed by athlete id so the client can
 * look a lane up instantly when the commentator switches heats — no refetch
 * needed, same "load everything for the floor up front" pattern
 * ScoreKeeperPage already uses for results/standings.
 */
export async function getCommentatorAthleteDetails(athleteIds: string[]): Promise<Record<string, CommentatorAthleteDetails>> {
  const uniqueIds = [...new Set(athleteIds)];
  if (uniqueIds.length === 0) return {};

  const supabase = await createClient();
  const { data: athleteRows } = await supabase.from("athletes").select("id, date_of_birth, gender").in("id", uniqueIds);
  const bioById = new Map((athleteRows ?? []).map((a) => [a.id, a]));

  const entries = await Promise.all(
    uniqueIds.map(async (athleteId) => {
      const [{ lifts, benchmarks }, history] = await Promise.all([
        getAthleteLiftsAndBenchmarks(athleteId, null),
        getAthleteCompetitionHistory(athleteId),
      ]);
      const bio = bioById.get(athleteId);
      const ageCategory = bio ? computeAgeCategory(bio.date_of_birth, bio.gender as Gender | null, new Date()) : null;
      const details: CommentatorAthleteDetails = {
        ageCategoryLabel: ageCategory ? AGE_CATEGORY_LABELS[ageCategory] : null,
        lifts,
        benchmarks,
        history: history.slice(0, MAX_HISTORY_EVENTS),
      };
      return [athleteId, details] as const;
    })
  );

  return Object.fromEntries(entries);
}
