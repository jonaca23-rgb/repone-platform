import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getFloorContext } from "@/lib/db/queries";
import { HeatOverlayClient } from "./HeatOverlayClient";

export default async function HeatOverlayPage({ params }: { params: Promise<{ floorId: string }> }) {
  const { floorId } = await params;
  const context = await getFloorContext(floorId);
  if (!context) notFound();

  const supabase = await createClient();
  const { data: broadcastState } = await supabase.from("broadcast_state").select("*").eq("floor_id", floorId).single();

  return <HeatOverlayClient floorId={floorId} heats={context.heats} initialBroadcastState={broadcastState ?? null} />;
}
