import { notFound } from "next/navigation";
import { getEventLiveContext } from "@/lib/db/queries";
import { EventHeatsList } from "@/components/EventHeatsList";

// Reference view of the full heat schedule across every floor — the live,
// "follow along" experience lives on the Dashboard tab; this tab is for
// glancing ahead at what's coming up next, same running order the
// Dashboard/Score Keeper/overlays all share (lib/scoring/divisionOrder.ts).
export default async function CommentatorEventHeatsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const context = await getEventLiveContext(eventId);
  if (!context) notFound();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <EventHeatsList floors={context.floors} />
    </div>
  );
}
