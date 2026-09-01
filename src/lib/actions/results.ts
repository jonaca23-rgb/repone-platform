"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { getSessionContext } from "@/lib/auth/session";
import { recomputeWodStandings } from "./standings";
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
  formData: FormData
) {
  const ctx = await getSessionContext();
  const competitorType = String(formData.get("competitor_type") ?? "athlete");
  const competitorId = String(formData.get("competitor_id") ?? "");
  if (!competitorId) throw new Error("Competitor is required.");

  const status = String(formData.get("status") ?? "completed") as "completed" | "dns" | "dnf" | "dq";

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
  };

  if (status !== "completed") {
    // DNS/DNF/DQ: leave numeric fields empty — the scoring engine ranks by
    // `status`, not by the presence of a number, so these always sort last.
  } else if (scoringType === "for_time") {
    row.time_seconds = numOrNull(formData.get("time_seconds"));
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
}

function numOrNull(value: FormDataEntryValue | null): number | null {
  if (value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
