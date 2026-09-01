import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getFloorContext } from "@/lib/db/queries";
import { TimerOverlayClient } from "./TimerOverlayClient";

// Standalone, ALWAYS-ON timer overlay — independent of the Program overlay's
// active_graphic toggle, for productions that want the clock permanently
// visible as its own browser-source layer (e.g. corner of screen).
export default async function TimerOverlayPage({ params }: { params: Promise<{ floorId: string }> }) {
  const { floorId } = await params;
  const context = await getFloorContext(floorId);
  if (!context) notFound();

  const supabase = await createClient();
  const { data: broadcastState } = await supabase.from("broadcast_state").select("*").eq("floor_id", floorId).single();

  return <TimerOverlayClient floorId={floorId} initialBroadcastState={broadcastState ?? null} />;
}
