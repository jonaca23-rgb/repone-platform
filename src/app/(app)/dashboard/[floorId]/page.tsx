import { cache } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getFloorContext } from "@/lib/db/queries";
import { getSessionContext } from "@/lib/auth/session";
import { isAssignedToEvent } from "@/lib/auth/eventRoles";
import { DashboardClient } from "./DashboardClient";

type Props = { params: Promise<{ floorId: string }> };

// Read once per request: the page and its title share it.
const floorContext = cache(getFloorContext);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const context = await floorContext((await params).floorId);
  return { title: context ? `Production · ${context.eventName}` : "Production" };
}

export default async function DashboardPage({ params }: Props) {
  const { floorId } = await params;
  const context = await floorContext(floorId);
  if (!context) notFound();

  // Defense in depth — see the matching comment in
  // scorekeeper/[floorId]/page.tsx. The new /producer/events/[eventId] tree
  // only links here for events the signed-in user is assigned to produce;
  // this catches a direct/bookmarked floor URL too.
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  if (!(await isAssignedToEvent(ctx, context.eventId, "producer"))) redirect("/producer");

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
