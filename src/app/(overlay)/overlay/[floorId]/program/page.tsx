import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getFloorContext } from "@/lib/db/queries";
import { getEventSponsors, toBroadcastSponsor } from "@/lib/db/sponsors";
import { ProgramOverlayClient } from "./ProgramOverlayClient";

// The primary "one browser source does it all" overlay: shows whichever
// graphic the Production Dashboard's [ SHOW ... ] buttons last selected.
export default async function ProgramOverlayPage({
  params,
}: {
  params: Promise<{ floorId: string }>;
}) {
  const { floorId } = await params;
  const context = await getFloorContext(floorId);
  if (!context) notFound();

  const supabase = await createClient();
  const [{ data: broadcastState }, sponsors] = await Promise.all([
    supabase.from("broadcast_state").select("*").eq("floor_id", floorId).single(),
    getEventSponsors(context.eventId),
  ]);

  return (
    <ProgramOverlayClient
      floorId={floorId}
      eventId={context.eventId}
      heats={context.heats}
      initialBroadcastState={broadcastState ?? null}
      sponsors={sponsors.map(toBroadcastSponsor)}
    />
  );
}
