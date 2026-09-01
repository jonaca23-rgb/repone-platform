"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";

export async function registerAthlete(eventId: string, formData: FormData) {
  const division_id = String(formData.get("division_id") ?? "");
  const athlete_id = String(formData.get("athlete_id") ?? "");
  const bib_number = String(formData.get("bib_number") ?? "") || null;
  if (!division_id || !athlete_id) throw new Error("Division and athlete are required.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("registrations")
    .insert({ event_id: eventId, division_id, athlete_id, bib_number });
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/events/${eventId}/athletes`);
}

export async function removeRegistration(eventId: string, registrationId: string) {
  const supabase = await createClient();
  await supabase.from("registrations").delete().eq("id", registrationId);
  revalidatePath(`/admin/events/${eventId}/athletes`);
}
