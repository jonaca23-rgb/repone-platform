"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { requireEventAccess } from "@/lib/auth/guards";
import { createClient } from "@/lib/db/server";
import { field, parseForm } from "@/lib/validation/form";
import { safeAction } from "./safeAction";

const FloorForm = z.object({ name: field.text("Floor name", { max: 100 }) });

export async function addFloor(
  eventId: string,
  venueId: string,
  formData: FormData,
): Promise<ActionResult> {
  return safeAction(async () => {
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
    if (!venue) return fail("That venue doesn't belong to this event.");

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
      return fail(`Floor added, but its broadcast state wasn't: ${broadcastError.message}`);
    }

    revalidatePath(`/admin/events/${eventId}/venues`);
    return ok();
  });
}
