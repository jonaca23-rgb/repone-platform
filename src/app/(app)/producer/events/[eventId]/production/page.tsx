import { notFound } from "next/navigation";
import { getEventLiveContext } from "@/lib/db/queries";
import { createClient } from "@/lib/db/server";
import { EventProducerProduction } from "./EventProducerProduction";

export default async function ProducerEventProductionPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const context = await getEventLiveContext(eventId);
  if (!context) notFound();

  const supabase = await createClient();
  const { data: sponsors } = await supabase
    .from("sponsors")
    .select("id, business_name, tier")
    .eq("active", true)
    .or(`event_id.eq.${eventId},event_id.is.null`);

  return (
    <EventProducerProduction
      eventId={eventId}
      eventName={context.eventName}
      floors={context.floors}
      sponsors={sponsors ?? []}
    />
  );
}
