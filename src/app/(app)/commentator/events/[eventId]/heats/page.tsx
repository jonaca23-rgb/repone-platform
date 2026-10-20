import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEventLiveContext } from "@/lib/db/queries";
import { EventHeatsList } from "@/components/EventHeatsList";
import { PageHeader } from "@/components/app/PageHeader";
import { commentatorEventTitle } from "../commentatorEvent";

type Props = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: await commentatorEventTitle((await params).eventId, "Heats") };
}

// Reference view of the full heat schedule across every floor — the live,
// "follow along" experience lives on the Dashboard tab; this tab is for
// glancing ahead at what's coming up next, same running order the
// Dashboard/Score Keeper/overlays all share (lib/scoring/divisionOrder.ts).
export default async function CommentatorEventHeatsPage({ params }: Props) {
  const { eventId } = await params;
  const context = await getEventLiveContext(eventId);
  if (!context) notFound();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <PageHeader title="Heats" />
      <EventHeatsList floors={context.floors} />
    </div>
  );
}
