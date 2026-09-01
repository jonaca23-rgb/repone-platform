import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getFloorContext } from "@/lib/db/queries";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage({ params }: { params: Promise<{ floorId: string }> }) {
  const { floorId } = await params;
  const context = await getFloorContext(floorId);
  if (!context) notFound();

  const supabase = await createClient();
  const [{ data: broadcastState }, { data: sponsors }] = await Promise.all([
    supabase.from("broadcast_state").select("*").eq("floor_id", floorId).single(),
    supabase
      .from("sponsors")
      .select("id, business_name, tier")
      .eq("active", true)
      .or(`event_id.eq.${context.eventId},event_id.is.null`),
  ]);

  return (
    <DashboardClient
      floorId={floorId}
      eventId={context.eventId}
      eventName={context.eventName}
      heats={context.heats}
      initialBroadcastState={broadcastState ?? null}
      sponsors={sponsors ?? []}
    />
  );
}
