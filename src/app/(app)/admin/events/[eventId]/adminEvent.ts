import { cache } from "react";
import { createClient } from "@/lib/db/server";

/**
 * The event an /admin/events/[eventId] page is under (id, name and start date), read once
 * per request and shared by the layout, the page and its metadata.
 */
export const getAdminEvent = cache(async (eventId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("id, name, starts_on")
    .eq("id", eventId)
    .maybeSingle();
  return data;
});

/** The event for a page under the layout, which has already 404ed a missing one. */
export async function requireAdminEvent(eventId: string) {
  const event = await getAdminEvent(eventId);
  if (!event) throw new Error("Event not found.");
  return event;
}
