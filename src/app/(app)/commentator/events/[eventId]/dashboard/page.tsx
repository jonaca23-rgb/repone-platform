import { notFound } from "next/navigation";
import { getEventLiveContext } from "@/lib/db/queries";
import { getCommentatorAthleteDetails } from "@/lib/db/commentator";
import { EventCommentatorDashboard } from "./EventCommentatorDashboard";

export default async function CommentatorEventDashboardPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const context = await getEventLiveContext(eventId);
  if (!context) notFound();

  // Every athlete across every floor's lanes, fetched once up front — same
  // "load it all, switch instantly" approach the standalone floor-scoped
  // /commentator/[floorId] route already uses.
  const athleteIds = context.floors.flatMap((f) =>
    f.heats.flatMap((h) => h.lanes.flatMap((l) => (l.athleteId ? [l.athleteId] : []))),
  );
  const detailsByAthleteId = await getCommentatorAthleteDetails(athleteIds);

  return (
    <EventCommentatorDashboard
      eventName={context.eventName}
      floors={context.floors}
      detailsByAthleteId={detailsByAthleteId}
    />
  );
}
