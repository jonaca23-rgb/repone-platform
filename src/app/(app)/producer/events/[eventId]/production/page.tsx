import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEventLiveContext } from "@/lib/db/queries";
import { createClient } from "@/lib/db/server";
import { producerEventTitle } from "../producerEvent";
import { EventProducerProduction } from "./EventProducerProduction";

type Props = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: await producerEventTitle((await params).eventId, "Production") };
}

export default async function ProducerEventProductionPage({ params }: Props) {
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
