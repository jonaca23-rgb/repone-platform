import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEventLiveContext } from "@/lib/db/queries";
import { EventHeatsList } from "@/components/EventHeatsList";
import { PageHeader } from "@/components/app/PageHeader";
import { producerEventTitle } from "../producerEvent";

type Props = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: await producerEventTitle((await params).eventId, "Heats") };
}

export default async function ProducerEventHeatsPage({ params }: Props) {
  const { eventId } = await params;
  const context = await getEventLiveContext(eventId);
  if (!context) notFound();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <PageHeader
        title="Heats"
        description="The full schedule by floor. The heat on air is marked Live."
      />
      <EventHeatsList floors={context.floors} />
    </div>
  );
}
