import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getFloorContext } from "@/lib/db/queries";
import { getEventSponsors, toBroadcastSponsor } from "@/lib/db/sponsors";
import { SponsorOverlayClient } from "./SponsorOverlayClient";

export default async function SponsorOverlayPage({
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
    <SponsorOverlayClient
      floorId={floorId}
      sponsors={sponsors.map(toBroadcastSponsor)}
      initialBroadcastState={broadcastState ?? null}
    />
  );
}
