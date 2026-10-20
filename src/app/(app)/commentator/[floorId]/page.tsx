import { cache } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getFloorContext } from "@/lib/db/queries";
import { getSessionContext } from "@/lib/auth/session";
import { isAssignedToEvent } from "@/lib/auth/eventRoles";
import { getCommentatorAthleteDetails } from "@/lib/db/commentator";
import { OperatorShell } from "@/components/shells/OperatorShell";
import { CommentatorClient } from "./CommentatorClient";

type Props = { params: Promise<{ floorId: string }> };

// Read once per request: the page and its title share it.
const floorContext = cache(getFloorContext);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const context = await floorContext((await params).floorId);
  return { title: context ? `Commentator · ${context.eventName}` : "Commentator" };
}

export default async function CommentatorPage({ params }: Props) {
  const { floorId } = await params;
  const context = await floorContext(floorId);
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
  const { data: broadcastState } = await supabase
    .from("broadcast_state")
    .select("*")
    .eq("floor_id", floorId)
    .single();

  // Every athlete in every lane of every heat on this floor, fetched once up
  // front (same "load it all, switch instantly on the client" approach
  // ScoreKeeperPage uses for results/standings) — so stepping between heats
  // or following the live one never triggers a fresh stats lookup mid-show.
  const athleteIds = context.heats.flatMap((h) =>
    h.lanes.flatMap((l) => (l.athleteId ? [l.athleteId] : [])),
  );
  const detailsByAthleteId = await getCommentatorAthleteDetails(athleteIds);

  return (
    <OperatorShell module="commentator" moduleLabel="Commentator" eventName={context.eventName}>
      <CommentatorClient
        floorId={floorId}
        heats={context.heats}
        initialBroadcastState={broadcastState ?? null}
        detailsByAthleteId={detailsByAthleteId}
      />
    </OperatorShell>
  );
}
