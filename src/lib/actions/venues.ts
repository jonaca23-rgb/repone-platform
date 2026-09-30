"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireEventAccess } from "@/lib/auth/guards";
import { createClient } from "@/lib/db/server";
import { field, parseForm } from "@/lib/validation/form";

const FloorForm = z.object({ name: field.text("Floor name", { max: 100 }) });

export async function addFloor(eventId: string, venueId: string, formData: FormData) {
  await requireEventAccess(eventId);
  const { name } = parseForm(FloorForm, formData);

  const supabase = await createClient();
  const { data: venue, error: venueError } = await supabase
    .from("venues")
    .select("id")
    .eq("id", venueId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (venueError) throw new Error(venueError.message);
  if (!venue) throw new Error("That venue doesn't belong to this event.");

  const { data: floor, error } = await supabase
    .from("floors")
    .insert({ venue_id: venue.id, name })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { error: broadcastError } = await supabase
    .from("broadcast_state")
    .insert({ floor_id: floor.id });
  if (broadcastError) {
    throw new Error(`Floor added, but its broadcast state wasn't: ${broadcastError.message}`);
  }

  revalidatePath(`/admin/events/${eventId}/venues`);
}
