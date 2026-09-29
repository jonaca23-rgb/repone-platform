"use server";

import { createClient } from "@/lib/db/server";
import {
  rankWodResults,
  computeOverallStandings,
  type RawResult,
  type WodScoringConfig,
} from "@/lib/scoring";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Recomputes the standings table for one WOD+division from the raw `results`
 * rows using the scoring engine — never hand-edited, always rebuildable.
 * Call this after every result entry/edit for that WOD/division.
 */
export async function recomputeWodStandings(wodId: string, divisionId: string) {
  const supabase = await createClient();

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

  const { data: results } = await supabase
    .from("results")
    .select("athlete_id, team_id, time_seconds, reps, load, points, capped, status, tiebreak_value")
    .in("heat_id", heatIds);

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
  });

  await recomputeOverallStandings(divisionId);
}

/** Recomputes the overall (wod_id = null) standings for a division across all its WODs. */
export async function recomputeOverallStandings(divisionId: string) {
  const supabase = await createClient();

  const { data: division } = await supabase
    .from("divisions")
    .select("id, event_id")
    .eq("id", divisionId)
    .single();
  if (!division) return;

  const { data: perWod } = await supabase
    .from("standings")
    .select("wod_id, athlete_id, team_id, placement, points")
    .eq("division_id", divisionId)
    .not("wod_id", "is", null);

  const byWod = new Map<
    string,
    { competitorId: string; placement: number | null; wodPoints: number | null }[]
  >();
  for (const row of perWod ?? []) {
    const wodId = row.wod_id as string;
    const list = byWod.get(wodId) ?? [];
    list.push({
      competitorId: (row.athlete_id ?? row.team_id) as string,
      placement: row.placement,
      wodPoints: row.points,
    });
    byWod.set(wodId, list);
  }

  const overall = computeOverallStandings(
    Array.from(byWod.entries()).map(([wodId, results]) => ({ wodId, results })),
  );

  await writeStandings(supabase, {
    wodId: null,
    divisionId,
    rows: overall.map((o) => ({
      competitorId: o.competitorId,
      placement: o.overallPlacement,
      points: o.totalPoints,
    })),
    eventId: division.event_id,
  });
}

async function writeStandings(
  supabase: SupabaseServerClient,
  args: {
    wodId: string | null;
    divisionId: string;
    rows: Array<{ competitorId: string; placement: number | null; points: number | null }>;
    eventId?: string;
  },
) {
  let eventId = args.eventId;
  if (!eventId) {
    const { data: division } = await supabase
      .from("divisions")
      .select("event_id")
      .eq("id", args.divisionId)
      .single();
    eventId = division?.event_id;
  }
  if (!eventId) return;

  // Determine athlete vs team by checking the athletes table once per batch.
  const ids = args.rows.map((r) => r.competitorId);
  const { data: athleteMatches } = ids.length
    ? await supabase.from("athletes").select("id").in("id", ids)
    : { data: [] as { id: string }[] };
  const athleteIds = new Set((athleteMatches ?? []).map((a) => a.id));

  const deleteQuery = supabase.from("standings").delete().eq("division_id", args.divisionId);
  if (args.wodId === null) {
    await deleteQuery.is("wod_id", null);
  } else {
    await deleteQuery.eq("wod_id", args.wodId);
  }

  if (args.rows.length === 0) return;

  const inserts = args.rows.map((r) => ({
    event_id: eventId!,
    division_id: args.divisionId,
    wod_id: args.wodId,
    athlete_id: athleteIds.has(r.competitorId) ? r.competitorId : null,
    team_id: athleteIds.has(r.competitorId) ? null : r.competitorId,
    placement: r.placement,
    points: r.points,
  }));

  await supabase.from("standings").insert(inserts);
}
