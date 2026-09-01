"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import type { ScoringTypeDb, TiebreakTypeDb } from "@/lib/db/database.types";

export async function createWod(eventId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const scoring_type = String(formData.get("scoring_type") ?? "for_time") as ScoringTypeDb;
  const tiebreak_type = String(formData.get("tiebreak_type") ?? "none") as TiebreakTypeDb;
  const description = String(formData.get("description") ?? "") || null;
  const rules = String(formData.get("rules") ?? "") || null;
  const time_cap_raw = String(formData.get("time_cap_minutes") ?? "");
  const time_cap_seconds = time_cap_raw ? Math.round(Number(time_cap_raw) * 60) : null;
  const lower_is_better = scoring_type === "for_time";

  if (!name) throw new Error("WOD name is required.");

  const supabase = await createClient();
  const { error } = await supabase.from("wods").insert({
    event_id: eventId,
    name,
    description,
    rules,
    scoring_type,
    tiebreak_type,
    time_cap_seconds,
    lower_is_better,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/events/${eventId}/wods`);
}

export async function deleteWod(eventId: string, wodId: string) {
  const supabase = await createClient();
  await supabase.from("wods").delete().eq("id", wodId);
  revalidatePath(`/admin/events/${eventId}/wods`);
}
