import { cache } from "react";
import { createClient } from "@/lib/db/server";

/**
 * The event a /producer/events/[eventId] page is under (id and name), read
 * once per request and shared by the layout and each page's metadata.
 */
export const getProducerEvent = cache(async (eventId: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("id, name").eq("id", eventId).maybeSingle();
  return data;
});

/** "<Tab> · <Event>" for a page under the event layout. */
export async function producerEventTitle(eventId: string, tab: string): Promise<string> {
  const event = await getProducerEvent(eventId);
  return event ? `${tab} · ${event.name}` : tab;
}
