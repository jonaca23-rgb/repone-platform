import { notFound } from "next/navigation";
import { getEventLiveContext } from "@/lib/db/queries";
import { EventHeatsList } from "@/components/EventHeatsList";

export default async function ProducerEventHeatsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const context = await getEventLiveContext(eventId);
  if (!context) notFound();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <EventHeatsList floors={context.floors} />
    </div>
  );
}
