"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getSessionContext } from "@/lib/auth/session";
import { recomputeWodStandings } from "./standings";
import { parseClockToSeconds } from "@/lib/timer/compute";
import type { ScoringTypeDb } from "@/lib/db/database.types";

/**
 * Enters/updates the RAW result for one competitor in one heat, matching the
 * WOD's scoring type — never a single generic "score" field — then rebuilds
 * standings for that WOD+division so the leaderboard stays in sync.
 */
export async function enterResult(
  eventId: string,
  heatId: string,
  wodId: string,
  divisionId: string,
  scoringType: ScoringTypeDb,
  floorId: string | null,
  formData: FormData,
) {
  const ctx = await getSessionContext();
  const competitorType = String(formData.get("competitor_type") ?? "athlete");
  const competitorId = String(formData.get("competitor_id") ?? "");
  if (!competitorId) throw new Error("Competitor is required.");

  const status = String(formData.get("status") ?? "completed") as
    | "completed"
    | "dns"
    | "dnf"
    | "dq";
  const manuallyAdjusted = formData.get("manual_adjustment") === "on";

  const row: Record<string, unknown> = {
    heat_id: heatId,
    wod_id: wodId,
    athlete_id: competitorType === "athlete" ? competitorId : null,
    team_id: competitorType === "team" ? competitorId : null,
    entered_by: ctx?.userId ?? null,
    capped: formData.get("capped") === "on",
    status,
    tiebreak_value: numOrNull(formData.get("tiebreak_value")),
    notes: String(formData.get("notes") ?? "") || null,
    manually_adjusted: manuallyAdjusted,
    adjusted_by: manuallyAdjusted ? (ctx?.userId ?? null) : null,
    adjusted_at: manuallyAdjusted ? new Date().toISOString() : null,
  };

  if (status !== "completed") {
    // DNS/DNF/DQ: leave numeric fields empty — the scoring engine ranks by
    // `status`, not by the presence of a number, so these always sort last.
  } else if (scoringType === "for_time") {
    row.time_seconds = timeOrNull(formData.get("time_seconds"));
    row.reps = row.capped ? numOrNull(formData.get("reps")) : null;
  } else if (scoringType === "amrap") {
    row.reps = numOrNull(formData.get("reps"));
  } else if (scoringType === "max_load") {
    row.load = numOrNull(formData.get("load"));
  } else {
    row.points = numOrNull(formData.get("points"));
  }

  const supabase = await createClient();
  const conflictTarget = competitorType === "athlete" ? "heat_id,athlete_id" : "heat_id,team_id";
  const { error } = await supabase.from("results").upsert(row, { onConflict: conflictTarget });
  if (error) throw new Error(error.message);

  await recomputeWodStandings(wodId, divisionId);

  revalidatePath(`/admin/events/${eventId}/heats/${heatId}`);
  revalidatePath(`/overlay`);
  if (floorId) revalidatePath(`/scorekeeper/${floorId}`);
}

/**
 * Saves EVERY lane's result for a heat in one submit ("Save All" on the
 * Heats & Lanes heat detail page), recomputes standings once (not once per
 * lane), then sends the operator back to the heats list. This is the admin
 * backup/bulk-entry path, as opposed to `enterResult`'s one-lane-at-a-time
 * save used on the live Score Keeper screen. It does NOT mark the heat as
 * finished — only the Score Keeper's own "Save all & Finish Heat" button
 * does that (see finishHeat in actions/heats.ts), once every lane's result
 * has actually been entered there.
 *
 * Field names are namespaced per athlete (`time_seconds__<athleteId>`, etc.)
 * since every lane's inputs live in one shared <form> here.
 */
export async function saveHeatResults(
  eventId: string,
  heatId: string,
  wodId: string,
  divisionId: string,
  scoringType: ScoringTypeDb,
  floorId: string | null,
  athleteIds: string[],
  formData: FormData,
) {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const rows = athleteIds.map((athleteId) => {
    const status = String(formData.get(`status__${athleteId}`) ?? "completed") as
      | "completed"
      | "dns"
      | "dnf"
      | "dq";
    const capped = formData.get(`capped__${athleteId}`) === "on";
    const manuallyAdjusted = formData.get(`manual_adjustment__${athleteId}`) === "on";

    const row: Record<string, unknown> = {
      heat_id: heatId,
      wod_id: wodId,
      athlete_id: athleteId,
      team_id: null,
      entered_by: ctx?.userId ?? null,
      capped,
      status,
      tiebreak_value: numOrNull(formData.get(`tiebreak_value__${athleteId}`)),
      notes: String(formData.get(`notes__${athleteId}`) ?? "") || null,
      manually_adjusted: manuallyAdjusted,
      adjusted_by: manuallyAdjusted ? (ctx?.userId ?? null) : null,
      adjusted_at: manuallyAdjusted ? new Date().toISOString() : null,
    };

    if (status === "completed") {
      if (scoringType === "for_time") {
        row.time_seconds = timeOrNull(formData.get(`time_seconds__${athleteId}`));
        row.reps = capped ? numOrNull(formData.get(`reps__${athleteId}`)) : null;
      } else if (scoringType === "amrap") {
        row.reps = numOrNull(formData.get(`reps__${athleteId}`));
      } else if (scoringType === "max_load") {
        row.load = numOrNull(formData.get(`load__${athleteId}`));
      } else {
        row.points = numOrNull(formData.get(`points__${athleteId}`));
      }
    }

    return row;
  });

  if (rows.length > 0) {
    const { error } = await supabase
      .from("results")
      .upsert(rows, { onConflict: "heat_id,athlete_id" });
    if (error) throw new Error(error.message);

    await recomputeWodStandings(wodId, divisionId);
  }

  // This used to also close the heat out (set ended_at) — that's now the
  // ScoreKeeper's own "Save all & Finish Heat" button (see finishHeat in
  // actions/heats.ts), since finishing should happen once the ScoreKeeper
  // has entered every lane's result, not whenever this admin backup form is
  // used to save/correct a batch of scores.
  revalidatePath(`/admin/events/${eventId}/heats`);
  revalidatePath(`/overlay`);
  if (floorId) revalidatePath(`/scorekeeper/${floorId}`);

  redirect(`/admin/events/${eventId}/heats`);
}

function numOrNull(value: FormDataEntryValue | null): number | null {
  if (value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Accepts what a judge actually writes on a scorecard — "3:45" — as well as
// plain seconds, so older entries and the raw number still work too.
function timeOrNull(value: FormDataEntryValue | null): number | null {
  if (value === null) return null;
  return parseClockToSeconds(String(value));
}
