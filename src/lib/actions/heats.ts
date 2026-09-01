"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";

export async function createHeat(eventId: string, formData: FormData) {
  const floor_id = String(formData.get("floor_id") ?? "");
  const wod_id = String(formData.get("wod_id") ?? "");
  const division_id = String(formData.get("division_id") ?? "");
  const heat_number = Number(formData.get("heat_number") ?? 0);
  const heat_count = Number(formData.get("heat_count") ?? 0) || null;
  const lane_count = Math.max(1, Math.min(20, Number(formData.get("lane_count") ?? 6)));
  const scheduled_start = String(formData.get("scheduled_start") ?? "") || null;

  if (!floor_id || !wod_id || !division_id || !heat_number) {
    throw new Error("Floor, WOD, division, and heat number are required.");
  }

  const supabase = await createClient();
  const { data: heat, error } = await supabase
    .from("heats")
    .insert({ event_id: eventId, floor_id, wod_id, division_id, heat_number, heat_count, scheduled_start })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const laneRows = Array.from({ length: lane_count }, (_, i) => ({
    heat_id: heat.id,
    lane_number: i + 1,
  }));
  await supabase.from("lanes").insert(laneRows);

  revalidatePath(`/admin/events/${eventId}/heats`);
}

export async function deleteHeat(eventId: string, heatId: string) {
  const supabase = await createClient();
  await supabase.from("heats").delete().eq("id", heatId);
  revalidatePath(`/admin/events/${eventId}/heats`);
}
