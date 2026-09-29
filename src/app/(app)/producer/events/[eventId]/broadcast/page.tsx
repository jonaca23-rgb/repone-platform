import { redirect } from "next/navigation";

// Jonathan's spec lists "Broadcast overlays" (item 9) and "Production
// dashboard" (item 10) as separate producer capabilities, with /production
// and /broadcast as sibling routes — but the one screen that exists today
// (DashboardClient, the Production tab) already IS the broadcast-overlay
// control surface: picking the live heat and toggling which graphic shows
// (lower third, timer, leaderboard, sponsor, etc.) drives broadcast_state
// directly, which is exactly what the OBS/YoloBox overlays read. Building a
// second, different screen for "broadcast control" without knowing what
// should differ from Production would just fork one feature into two UIs
// showing the same data. This route is a placeholder alias until Jonathan
// says what, if anything, Broadcast should show that Production doesn't
// (e.g. a stripped-down graphics-only trigger panel with no heat/lane
// chrome) — flagged in architecture/rbac-audit-and-plan.md.
export default async function ProducerEventBroadcastPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  redirect(`/producer/events/${eventId}/production`);
}
