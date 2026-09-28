import Link from "next/link";
import { createClient } from "@/lib/db/server";

// Read-only sponsor list for this event — per spec, a producer "triggers"
// sponsor graphics rather than managing the sponsors table itself (that
// stays admin-only, 0002_rls_and_realtime.sql). Triggering which sponsor
// shows on the broadcast happens from the Production tab's existing graphic
// controls (broadcast_state.active_graphic); this page is the reference
// list plus a link there.
export default async function ProducerEventSponsorsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await createClient();

  const { data: sponsors } = await supabase
    .from("sponsors")
    .select("id, business_name, tier, active")
    .eq("active", true)
    .or(`event_id.eq.${eventId},event_id.is.null`)
    .order("business_name");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <p className="mb-4 text-sm text-white/50">
        To trigger a sponsor graphic on the broadcast, use the graphic controls on the{" "}
        <Link href={`/producer/events/${eventId}/production`} className="text-repone-red underline">
          Production
        </Link>{" "}
        tab.
      </p>
      <div className="flex flex-col gap-1.5">
        {(sponsors ?? []).map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-lg bg-repone-gray px-4 py-2.5">
            <span className="font-semibold text-white">{s.business_name}</span>
            <span className="rounded-full bg-black/40 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-repone-red">
              {s.tier.replace(/_/g, " ")}
            </span>
          </div>
        ))}
        {(sponsors ?? []).length === 0 && <p className="text-white/50">No active sponsors for this event.</p>}
      </div>
    </div>
  );
}
