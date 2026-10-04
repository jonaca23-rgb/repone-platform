import type { Metadata } from "next";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import type { SponsorTier } from "@/lib/db/database.types";
import { PageHeader } from "@/components/app/PageHeader";
import { type SponsorRow, SponsorsTable } from "./SponsorsTable";

export const metadata: Metadata = { title: "Sponsors" };

export default async function SponsorsPage() {
  const ctx = await getSessionContext();
  const supabase = await createClient();
  const [{ data: sponsors }, { data: events }] = await Promise.all([
    supabase
      .from("sponsors")
      .select("id, business_name, tier, category, category_exclusive, active, event_id")
      .eq("organization_id", ctx?.organizationId ?? "")
      .order("created_at", { ascending: false }),
    supabase
      .from("events")
      .select("id, name")
      .eq("organization_id", ctx?.organizationId ?? ""),
  ]);

  const eventName = new Map((events ?? []).map((e) => [e.id, e.name]));
  const rows: SponsorRow[] = (sponsors ?? []).map((s) => ({
    id: s.id,
    business_name: s.business_name,
    tier: s.tier as SponsorTier,
    category: s.category,
    category_exclusive: s.category_exclusive,
    active: s.active,
    eventName: s.event_id ? (eventName.get(s.event_id) ?? "Unknown event") : "All events",
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sponsors"
        description="RepOneLive inventory tiers. Category-exclusive sponsors are enforced per event."
      />
      <SponsorsTable rows={rows} events={events ?? []} />
    </div>
  );
}
