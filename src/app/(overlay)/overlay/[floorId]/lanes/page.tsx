import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getFloorContext } from "@/lib/db/queries";
import { LanesOverlayClient } from "./LanesOverlayClient";

export default async function LanesOverlayPage({
  params,
}: {
  params: Promise<{ floorId: string }>;
}) {
  const { floorId } = await params;
  const context = await getFloorContext(floorId);
  if (!context) notFound();

  const supabase = await createClient();
  const { data: broadcastState } = await supabase
    .from("broadcast_state")
    .select("*")
    .eq("floor_id", floorId)
    .single();

  return (
    <LanesOverlayClient
      floorId={floorId}
      heats={context.heats}
      initialBroadcastState={broadcastState ?? null}
    />
  );
}
