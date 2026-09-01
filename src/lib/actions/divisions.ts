"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";

export async function createDivision(eventId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Division name is required.");

  const supabase = await createClient();
  const { error } = await supabase.from("divisions").insert({ event_id: eventId, name });
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/events/${eventId}/divisions`);
}

export async function deleteDivision(eventId: string, divisionId: string) {
  const supabase = await createClient();
  await supabase.from("divisions").delete().eq("id", divisionId);
  revalidatePath(`/admin/events/${eventId}/divisions`);
}
