import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEventLiveContext } from "@/lib/db/queries";
import { getCommentatorAthleteDetails } from "@/lib/db/commentator";
import { commentatorEventTitle } from "../commentatorEvent";
import { EventCommentatorDashboard } from "./EventCommentatorDashboard";

type Props = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: await commentatorEventTitle((await params).eventId, "Dashboard") };
}

export default async function CommentatorEventDashboardPage({ params }: Props) {
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
    <EventCommentatorDashboard floors={context.floors} detailsByAthleteId={detailsByAthleteId} />
  );
}
