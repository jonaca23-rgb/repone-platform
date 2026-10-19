import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/db/server";
import { loadDisplaySnapshot } from "@/lib/display/snapshot";
import { DisplayPlayer } from "./DisplayPlayer";

export default async function VenueDisplayPage({
  params,
}: {
  params: Promise<{ eventId: string; displayId: string }>;
}) {
  const { eventId, displayId } = await params;
  // A mistyped URL is a page that doesn't exist, not a database error the
  // kiosk would keep retrying.
  const isId = (v: string) => z.guid().safeParse(v).success;
  if (!isId(eventId) || !isId(displayId)) notFound();
  const snapshot = await loadDisplaySnapshot(eventId, displayId);
  if (!snapshot) notFound();

  const supabase = await createClient();
  const { data: broadcastState } = await supabase
    .from("broadcast_state")
    .select("*")
    .eq("floor_id", snapshot.device.floorId)
    .maybeSingle();

  return <DisplayPlayer snapshot={snapshot} initialBroadcastState={broadcastState ?? null} />;
}
