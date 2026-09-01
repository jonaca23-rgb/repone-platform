"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";

export async function addFloor(eventId: string, venueId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Floor name is required.");

  const supabase = await createClient();
  const { data: floor, error } = await supabase
    .from("floors")
    .insert({ venue_id: venueId, name })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await supabase.from("broadcast_state").insert({ floor_id: floor.id });

  revalidatePath(`/admin/events/${eventId}/venues`);
}
