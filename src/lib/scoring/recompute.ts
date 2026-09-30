// Standings rebuilds, called by the result/heat server actions AFTER they've
// authorized the caller. Deliberately NOT a "use server" module: exported
// functions in one of those become public endpoints any browser can call,
// and these take bare WOD/division ids with no guard of their own.
import { createClient } from "@/lib/db/server";
import { sqlNull } from "@/lib/db/sqlNull";
import {
  rankWodResults,
  computeOverallStandings,
  type RawResult,
  type WodResultsForStandings,
  type WodScoringConfig,
} from "@/lib/scoring";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Recomputes the standings table for one WOD+division from the raw `results`
 * rows using the scoring engine — never hand-edited, always rebuildable.
 * Call this after every result entry/edit for that WOD/division.
 */
export async function recomputeWodStandings(
  wodId: string,
  divisionId: string,
  client?: SupabaseServerClient,
) {
  const supabase = client ?? (await createClient());

  const { data: wod } = await supabase
    .from("wods")
    .select("id, scoring_type, time_cap_seconds, tiebreak_type, lower_is_better")
    .eq("id", wodId)
    .single();
  if (!wod) return;

  const config: WodScoringConfig = {
    id: wod.id,
    scoringType: wod.scoring_type,
    timeCapSeconds: wod.time_cap_seconds,
    tiebreakType: wod.tiebreak_type,
    lowerIsBetter: wod.lower_is_better,
  };

  const { data: heatsInDivision } = await supabase
    .from("heats")
    .select("id")
    .eq("wod_id", wodId)
    .eq("division_id", divisionId);
  const heatIds = (heatsInDivision ?? []).map((h) => h.id);
  if (heatIds.length === 0) return;

  const { data: results, error: resultsError } = await supabase
    .from("results")
    .select("athlete_id, team_id, time_seconds, reps, load, points, capped, status, tiebreak_value")
    .in("heat_id", heatIds);
  if (resultsError) throw new Error(resultsError.message);

  const raw: RawResult[] = (results ?? []).map((r) => ({
    competitorId: (r.athlete_id ?? r.team_id) as string,
    timeSeconds: r.time_seconds,
    reps: r.reps,
    load: r.load,
    points: r.points,
    capped: r.capped,
    status: r.status,
    tiebreakValue: r.tiebreak_value,
  }));

  const ranked = rankWodResults(raw, config);

  await writeStandings(supabase, {
    wodId,
    divisionId,
    rows: ranked.map((r) => ({
      competitorId: r.competitorId,
      placement: r.placement,
      points: r.wodPoints,
    })),
    kinds: competitorKinds(results ?? []),
  });

  await recomputeOverallStandings(divisionId, supabase);
}

/**
 * Recomputes the overall (wod_id = null) standings for a division across all
 * its WODs. Everyone registered in the division is considered, and a WOD
 * counts against competitors with no result only once all of its heats in
 * the division have finished (see computeOverallStandings).
 */
export async function recomputeOverallStandings(divisionId: string, client?: SupabaseServerClient) {
  const supabase = client ?? (await createClient());

  const [perWodRes, registrationsRes, heatsRes] = await Promise.all([
    supabase
      .from("standings")
      .select("wod_id, athlete_id, team_id, placement, points")
      .eq("division_id", divisionId)
      .not("wod_id", "is", null),
    supabase.from("registrations").select("athlete_id, team_id").eq("division_id", divisionId),
    supabase.from("heats").select("wod_id, ended_at").eq("division_id", divisionId),
  ]);
  for (const res of [perWodRes, registrationsRes, heatsRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const byWod = new Map<string, WodResultsForStandings>();
  for (const heat of heatsRes.data ?? []) {
    const wod = byWod.get(heat.wod_id) ?? { wodId: heat.wod_id, results: [], complete: true };
    wod.complete = wod.complete && heat.ended_at !== null;
    byWod.set(heat.wod_id, wod);
  }
  for (const row of perWodRes.data ?? []) {
    const wodId = row.wod_id as string;
    const wod = byWod.get(wodId) ?? { wodId, results: [], complete: false };
    wod.results.push({
      competitorId: (row.athlete_id ?? row.team_id) as string,
      placement: row.placement,
      wodPoints: row.points,
    });
    byWod.set(wodId, wod);
  }

  const kinds = competitorKinds(registrationsRes.data ?? [], perWodRes.data ?? []);
  const overall = computeOverallStandings(Array.from(byWod.values()), {
    competitorIds: Array.from(kinds.keys()),
  });

  await writeStandings(supabase, {
    wodId: null,
    divisionId,
    rows: overall.map((o) => ({
      competitorId: o.competitorId,
      placement: o.overallPlacement,
      points: o.totalPoints,
    })),
    kinds,
  });
}

type CompetitorKind = "athlete" | "team";

/** competitor id -> athlete or team, from rows that carry athlete_id/team_id. */
function competitorKinds(
  ...sources: Array<Array<{ athlete_id: string | null; team_id: string | null }>>
): Map<string, CompetitorKind> {
  const kinds = new Map<string, CompetitorKind>();
  for (const rows of sources) {
    for (const r of rows) {
      if (r.athlete_id) kinds.set(r.athlete_id, "athlete");
      else if (r.team_id) kinds.set(r.team_id, "team");
    }
  }
  return kinds;
}

/**
 * Replaces one division's standings for one WOD (or overall) atomically via
 * replace_standings (0026_atomic_standings.sql), so concurrent saves queue
 * instead of interleaving into a duplicated or empty leaderboard.
 */
async function writeStandings(
  supabase: SupabaseServerClient,
  args: {
    wodId: string | null;
    divisionId: string;
    rows: Array<{ competitorId: string; placement: number | null; points: number | null }>;
    kinds: Map<string, CompetitorKind>;
  },
) {
  const { error } = await supabase.rpc("replace_standings", {
    p_division_id: args.divisionId,
    p_wod_id: sqlNull(args.wodId),
    p_rows: args.rows.map((r) => {
      const isTeam = args.kinds.get(r.competitorId) === "team";
      return {
        athlete_id: isTeam ? null : r.competitorId,
        team_id: isTeam ? r.competitorId : null,
        placement: r.placement,
        points: r.points,
      };
    }),
  });
  if (error) throw new Error(`Could not update standings: ${error.message}`);
}
