import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getFloorContext } from "@/lib/db/queries";
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
  const [{ data: broadcastState }, { data: sponsors }] = await Promise.all([
    supabase.from("broadcast_state").select("*").eq("floor_id", floorId).single(),
    supabase.from("sponsors").select("id, business_name, logo_url, tier").eq("active", true),
  ]);

  return (
    <SponsorOverlayClient
      floorId={floorId}
      sponsors={sponsors ?? []}
      initialBroadcastState={broadcastState ?? null}
    />
  );
}
