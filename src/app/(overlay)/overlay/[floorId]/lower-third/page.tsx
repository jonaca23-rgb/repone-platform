import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getFloorContext } from "@/lib/db/queries";
import { LowerThirdOverlayClient } from "./LowerThirdOverlayClient";

export default async function LowerThirdOverlayPage({ params }: { params: Promise<{ floorId: string }> }) {
  const { floorId } = await params;
  const context = await getFloorContext(floorId);
  if (!context) notFound();

  const supabase = await createClient();
  const { data: broadcastState } = await supabase.from("broadcast_state").select("*").eq("floor_id", floorId).single();

  return (
    <LowerThirdOverlayClient floorId={floorId} eventId={context.eventId} initialBroadcastState={broadcastState ?? null} />
  );
}
