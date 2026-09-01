"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";

export async function assignLane(eventId: string, heatId: string, laneId: string, formData: FormData) {
  const athlete_id = String(formData.get("athlete_id") ?? "") || null;

  const supabase = await createClient();
  const { error } = await supabase.from("lanes").update({ athlete_id }).eq("id", laneId);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/events/${eventId}/heats/${heatId}`);
}
