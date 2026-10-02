import type { Metadata } from "next";
import Link from "next/link";
import { Megaphone } from "lucide-react";
import { createClient } from "@/lib/db/server";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { Badge } from "@/components/ui/badge";
import { producerEventTitle } from "../producerEvent";

type Props = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: await producerEventTitle((await params).eventId, "Sponsors") };
}

// Read-only sponsor list for this event — per spec, a producer "triggers"
// sponsor graphics rather than managing the sponsors table itself (that
// stays admin-only, 0002_rls_and_realtime.sql). Triggering which sponsor
// shows on the broadcast happens from the Production tab's existing graphic
// controls (broadcast_state.active_graphic); this page is the reference
// list plus a link there.
export default async function ProducerEventSponsorsPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();

  const { data: sponsors } = await supabase
    .from("sponsors")
    .select("id, business_name, tier, active")
    .eq("active", true)
    .or(`event_id.eq.${eventId},event_id.is.null`)
    .order("business_name");

  const rows = sponsors ?? [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <PageHeader title="Sponsors" />
      <p className="text-sm text-muted-foreground">
        To trigger a sponsor graphic on the broadcast, use the graphic controls on the{" "}
        <Link
          href={`/producer/events/${eventId}/production`}
          className="rounded-sm text-brand-text underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
        >
          Production
        </Link>{" "}
        tab.
      </p>
      {rows.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {rows.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-2.5"
            >
              <span className="font-semibold">{s.business_name}</span>
              <Badge variant="outline" className="uppercase">
                {s.tier.replace(/_/g, " ")}
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Megaphone} title="No active sponsors for this event" />
      )}
    </div>
  );
}
