"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { NotAuthorizedError, requireHeatAccess } from "@/lib/auth/guards";
import { createClient } from "@/lib/db/server";
import { Constants } from "@/lib/db/supabase.types";
import { recomputeWodStandings } from "@/lib/scoring/recompute";
import { field, parseForm } from "@/lib/validation/form";
import type { Insert, ScoringTypeDb } from "@/lib/db/database.types";
import { safeAction } from "./safeAction";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Results are entered by an org manager or by scorekeepers/producers assigned
// to the heat's event (requireHeatAccess). The event, WOD, division and floor
// all come from the heat row on the server, and the scoring type from the
// WOD row.

const status = z.preprocess(
  (v) => (v === undefined || v === "" ? "completed" : v),
  field.oneOf(Constants.public.Enums.result_status, "result status"),
);

/** One competitor's scorecard (field names without any per-lane suffix). */
const ScoreFields = z.object({
  status,
  capped: field.checkbox(),
  manual_adjustment: field.checkbox(),
  time_seconds: field.clock("Time"),
  reps: field.optionalNumber("Reps", { min: 0 }),
  load: field.optionalNumber("Load", { min: 0 }),
  points: field.optionalNumber("Points", { min: 0 }),
  tiebreak_value: field.optionalNumber("Tie-break", { min: 0 }),
  notes: field.optionalText({ label: "Notes" }),
});

const EnterResultForm = ScoreFields.extend({
  competitor_type: z.preprocess(
    (v) => (v === undefined || v === "" ? "athlete" : v),
    field.oneOf(["athlete", "team"] as const, "competitor type"),
  ),
  competitor_id: field.id("Competitor"),
});

type Scorecard = z.infer<typeof ScoreFields>;

const NO_WOD = "This heat's WOD no longer exists.";

/** The heat's WOD scoring type, or null when the WOD is gone. */
async function wodScoringType(
  supabase: SupabaseServerClient,
  wodId: string,
): Promise<ScoringTypeDb | null> {
  const { data, error } = await supabase
    .from("wods")
    .select("scoring_type")
    .eq("id", wodId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.scoring_type ?? null;
}

/**
 * The athletes/teams who may get a result in this heat: whoever is laned in
 * it, plus anyone registered in the heat's division (a late swap that the
 * lanes haven't caught up with).
 */
async function eligibleCompetitors(
  supabase: SupabaseServerClient,
  heat: { id: string; event_id: string; division_id: string },
) {
  const [lanesRes, regsRes] = await Promise.all([
    supabase.from("lanes").select("athlete_id, team_id").eq("heat_id", heat.id),
    supabase
      .from("registrations")
      .select("athlete_id, team_id")
      .eq("event_id", heat.event_id)
      .eq("division_id", heat.division_id),
  ]);
  if (lanesRes.error) throw new Error(lanesRes.error.message);
  if (regsRes.error) throw new Error(regsRes.error.message);

  const athletes = new Set<string>();
  const teams = new Set<string>();
  for (const r of [...(lanesRes.data ?? []), ...(regsRes.data ?? [])]) {
    if (r.athlete_id) athletes.add(r.athlete_id);
    if (r.team_id) teams.add(r.team_id);
  }
  return { athletes, teams };
}

/** The scoring-type-specific numbers for a completed result; DNS/DNF/DQ carry none. */
function scoreColumns(card: Scorecard, scoringType: ScoringTypeDb): Partial<Insert<"results">> {
  // DNS/DNF/DQ: leave numeric fields empty — the scoring engine ranks by
  // `status`, not by the presence of a number, so these always sort last.
  if (card.status !== "completed") return {};
  if (scoringType === "for_time") {
    return { time_seconds: card.time_seconds, reps: card.capped ? card.reps : null };
  }
  if (scoringType === "amrap") return { reps: card.reps };
  if (scoringType === "max_load") return { load: card.load };
  return { points: card.points };
}

function resultRow(
  card: Scorecard,
  scoringType: ScoringTypeDb,
  base: Pick<Insert<"results">, "heat_id" | "wod_id" | "athlete_id" | "team_id">,
  userId: string,
): Insert<"results"> {
  return {
    ...base,
    entered_by: userId,
    capped: card.capped,
    status: card.status,
    tiebreak_value: card.tiebreak_value,
    notes: card.notes,
    manually_adjusted: card.manual_adjustment,
    adjusted_by: card.manual_adjustment ? userId : null,
    adjusted_at: card.manual_adjustment ? new Date().toISOString() : null,
    ...scoreColumns(card, scoringType),
  };
}

/**
 * Enters/updates the RAW result for one competitor in one heat, matching the
 * WOD's scoring type — never a single generic "score" field — then rebuilds
 * standings for that WOD+division so the leaderboard stays in sync. Used by
 * the score drawer on the Score Keeper screen and the admin heat's Results tab.
 */
export async function enterResult(heatId: string, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { ctx, eventId, heat } = await requireHeatAccess(heatId, ["scorekeeper", "producer"]);
    const form = parseForm(EnterResultForm, formData);

    const supabase = await createClient();
    const [scoringType, eligible] = await Promise.all([
      wodScoringType(supabase, heat.wod_id),
      eligibleCompetitors(supabase, heat),
    ]);
    if (!scoringType) return fail(NO_WOD);
    const isAthlete = form.competitor_type === "athlete";
    if (!(isAthlete ? eligible.athletes : eligible.teams).has(form.competitor_id)) {
      throw new NotAuthorizedError("That competitor isn't in this heat.");
    }

    const row = resultRow(
      form,
      scoringType,
      {
        heat_id: heat.id,
        wod_id: heat.wod_id,
        athlete_id: isAthlete ? form.competitor_id : null,
        team_id: isAthlete ? null : form.competitor_id,
      },
      ctx.userId,
    );
    const conflictTarget = isAthlete ? "heat_id,athlete_id" : "heat_id,team_id";
    const { error } = await supabase.from("results").upsert(row, { onConflict: conflictTarget });
    if (error) throw new Error(error.message);

    await recomputeWodStandings(heat.wod_id, heat.division_id, supabase);

    revalidatePath(`/admin/events/${eventId}/heats/${heat.id}`);
    revalidatePath(`/overlay`);
    if (heat.floor_id) revalidatePath(`/scorekeeper/${heat.floor_id}`);
    return ok();
  });
}
