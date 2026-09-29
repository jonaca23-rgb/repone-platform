import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventLiveContext } from "@/lib/db/queries";

// Event-level overview/command-center — "1. Event dashboard" in the spec,
// distinct from the "10. Production dashboard" (live floor control, the
// Production tab, which is today's existing Production Dashboard screen).
// Quick status + links into the other tabs; the actual live-running work
// happens on Production/Broadcast.
export default async function ProducerEventDashboardPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const context = await getEventLiveContext(eventId);
  if (!context) notFound();

  const totalHeats = context.floors.reduce((sum, f) => sum + f.heats.length, 0);
  const liveFloors = context.floors.filter((f) => f.initialBroadcastState?.current_heat_id);

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-6 sm:grid-cols-2 lg:grid-cols-3">
      <div className="rounded-xl bg-repone-gray p-5">
        <p className="text-xs uppercase tracking-widest text-white/50">Status</p>
        <p className="mt-1 text-2xl font-bold uppercase text-white">{context.eventStatus}</p>
      </div>
      <div className="rounded-xl bg-repone-gray p-5">
        <p className="text-xs uppercase tracking-widest text-white/50">Floors</p>
        <p className="mt-1 text-2xl font-bold text-white">
          {context.floors.length}{" "}
          <span className="text-sm font-normal text-white/50">({liveFloors.length} live)</span>
        </p>
      </div>
      <div className="rounded-xl bg-repone-gray p-5">
        <p className="text-xs uppercase tracking-widest text-white/50">Heats</p>
        <p className="mt-1 text-2xl font-bold text-white">{totalHeats}</p>
      </div>
      <Link href={`/producer/events/${eventId}/production`} className="control-btn control-btn-red">
        Run Production →
      </Link>
      <Link href={`/live/${eventId}`} target="_blank" className="control-btn">
        Public Leaderboard →
      </Link>
      <Link href={`/admin/events/${eventId}`} className="control-btn">
        Event Setup (Admin) →
      </Link>
    </div>
  );
}
