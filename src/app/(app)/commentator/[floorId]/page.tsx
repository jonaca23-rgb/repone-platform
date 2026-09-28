import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getFloorContext } from "@/lib/db/queries";
import { getSessionContext } from "@/lib/auth/session";
import { isAssignedToEvent } from "@/lib/auth/eventRoles";
import { getCommentatorAthleteDetails } from "@/lib/db/commentator";
import { CommentatorClient } from "./CommentatorClient";

export default async function CommentatorPage({ params }: { params: Promise<{ floorId: string }> }) {
  const { floorId } = await params;
  const context = await getFloorContext(floorId);
  if (!context) notFound();

  // Defense in depth — see the matching comment in
  // scorekeeper/[floorId]/page.tsx. The new /commentator/events/[eventId]
  // tree only links here for events the signed-in user is assigned to
  // commentate (or produce — producers can view the Commentator Dashboard
  // too, per spec); this catches a direct/bookmarked floor URL too.
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  const allowed =
    (await isAssignedToEvent(ctx, context.eventId, "commentator")) ||
    (await isAssignedToEvent(ctx, context.eventId, "producer"));
  if (!allowed) redirect("/commentator");

  const supabase = await createClient();
  const { data: broadcastState } = await supabase.from("broadcast_state").select("*").eq("floor_id", floorId).single();

  // Every athlete in every lane of every heat on this floor, fetched once up
  // front (same "load it all, switch instantly on the client" approach
  // ScoreKeeperPage uses for results/standings) — so stepping between heats
  // or following the live one never triggers a fresh stats lookup mid-show.
  const athleteIds = context.heats.flatMap((h) => h.lanes.flatMap((l) => (l.athleteId ? [l.athleteId] : [])));
  const detailsByAthleteId = await getCommentatorAthleteDetails(athleteIds);

  return (
    <CommentatorClient
      floorId={floorId}
      eventName={context.eventName}
      heats={context.heats}
      initialBroadcastState={broadcastState ?? null}
      detailsByAthleteId={detailsByAthleteId}
    />
  );
}
