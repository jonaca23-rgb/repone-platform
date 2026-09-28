"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/db/server";

// Registering a whole category (e.g. 15 athletes into "Rx Male") one at a
// time means re-picking the same division every single submit. Remembering
// the last division used — per event, in a cookie rather than a DB column,
// since this is a pure per-browser convenience with no need to sync across
// staff/devices — lets the Athletes & Registrations page default the
// division select to it, so the operator only has to change it when they
// actually move on to a new category.
function lastDivisionCookieName(eventId: string) {
  return `repone_last_division_${eventId}`;
}

/**
 * Returns `{ error }` instead of throwing so it plugs into `useActionState`
 * (see RegisterForms.tsx) — a thrown error here used to surface as Next's
 * full-page/dev error overlay instead of a normal, dismissable alert.
 */
export async function registerAthlete(
  eventId: string,
  _prevState: { error: string },
  formData: FormData
): Promise<{ error: string }> {
  const division_id = String(formData.get("division_id") ?? "");
  const athlete_id = String(formData.get("athlete_id") ?? "");
  const bib_number = String(formData.get("bib_number") ?? "") || null;
  if (!division_id || !athlete_id) return { error: "Division and athlete are required." };

  const supabase = await createClient();

  // Registering the same athlete into the same division twice used to go
  // through silently — generateHeats() then had two registration rows to
  // place, which could land the same athlete in two lanes of one heat (a
  // duplicate-key crash on Score Keeper, and a real double-booking).
  const { data: existing } = await supabase
    .from("registrations")
    .select("id")
    .eq("event_id", eventId)
    .eq("division_id", division_id)
    .eq("athlete_id", athlete_id)
    .maybeSingle();
  if (existing) return { error: "This athlete is already registered in this division/category." };

  const { error } = await supabase
    .from("registrations")
    .insert({ event_id: eventId, division_id, athlete_id, bib_number });
  if (error) {
    // 23505 = unique_violation — DB-level backstop from
    // 0012_prevent_duplicate_lane_and_registration_assignments.sql.
    if (error.code === "23505") return { error: "This athlete is already registered in this division/category." };
    return { error: error.message };
  }

  const cookieStore = await cookies();
  cookieStore.set(lastDivisionCookieName(eventId), division_id, { maxAge: 60 * 60 * 24 * 180, sameSite: "lax" });

  revalidatePath(`/admin/events/${eventId}/athletes`);
  return { error: "" };
}

export async function registerTeam(
  eventId: string,
  _prevState: { error: string },
  formData: FormData
): Promise<{ error: string }> {
  const division_id = String(formData.get("division_id") ?? "");
  const team_id = String(formData.get("team_id") ?? "");
  const bib_number = String(formData.get("bib_number") ?? "") || null;
  if (!division_id || !team_id) return { error: "Division and team are required." };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("registrations")
    .select("id")
    .eq("event_id", eventId)
    .eq("division_id", division_id)
    .eq("team_id", team_id)
    .maybeSingle();
  if (existing) return { error: "This team is already registered in this division/category." };

  const { error } = await supabase
    .from("registrations")
    .insert({ event_id: eventId, division_id, team_id, bib_number });
  if (error) {
    if (error.code === "23505") return { error: "This team is already registered in this division/category." };
    return { error: error.message };
  }

  const cookieStore = await cookies();
  cookieStore.set(lastDivisionCookieName(eventId), division_id, { maxAge: 60 * 60 * 24 * 180, sameSite: "lax" });

  revalidatePath(`/admin/events/${eventId}/athletes`);
  return { error: "" };
}

export async function removeRegistration(eventId: string, registrationId: string) {
  const supabase = await createClient();
  await supabase.from("registrations").delete().eq("id", registrationId);
  revalidatePath(`/admin/events/${eventId}/athletes`);
}
