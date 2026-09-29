import { notFound } from "next/navigation";
import { getEventLiveContext } from "@/lib/db/queries";
import { LiveEventClient } from "@/app/(app)/live/[eventId]/LiveEventClient";

// Same "Now Competing" + per-division leaderboard the public /live/[eventId]
// page shows spectators — a commentator needs the exact same view, just
// reached from inside the staff-only event tree instead of the public site.
export default async function CommentatorEventLeaderboardPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const context = await getEventLiveContext(eventId);
  if (!context) notFound();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <LiveEventClient floors={context.floors} divisions={context.divisions} />
    </div>
  );
}
