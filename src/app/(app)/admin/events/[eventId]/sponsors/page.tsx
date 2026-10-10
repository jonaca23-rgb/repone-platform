import type { Metadata } from "next";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { effectiveDisplay } from "@/lib/sponsors/effective";
import { PageHeader } from "@/components/app/PageHeader";
import { AdminBreadcrumb, eventCrumbs } from "@/components/shells/AdminBreadcrumb";
import { getAdminEvent, requireAdminEvent } from "../adminEvent";
import { type EventSponsorshipRow, EventSponsorsTable } from "./EventSponsorsTable";

type Props = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await getAdminEvent((await params).eventId);
  return { title: event ? `Sponsors · ${event.name}` : "Sponsors" };
}

interface RawRow {
  id: string;
  sponsor_id: string;
  package_id: string;
  category_exclusive: boolean;
  display_duration_override: number | null;
  display_weight_override: number | null;
  active: boolean;
  sponsors: { business_name: string; category: string | null } | null;
  sponsor_packages: {
    name: string;
    display_enabled: boolean;
    display_duration_seconds: number;
    display_weight: number;
  } | null;
}

/**
 * Which of the organization's sponsors are at this event, on which package,
 * and with which overrides. Switched-off sponsorships stay listed so they can
 * be switched back on.
 */
export default async function EventSponsorsPage({ params }: Props) {
  const { eventId } = await params;
  const event = await requireAdminEvent(eventId);
  const orgId = (await getSessionContext())?.organizationId ?? "";
  const supabase = await createClient();

  const [sponsorships, sponsors, packages] = await Promise.all([
    supabase
      .from("event_sponsorships")
      .select(
        "id, sponsor_id, package_id, category_exclusive, display_duration_override, display_weight_override, active, sponsors(business_name, category), sponsor_packages(name, display_enabled, display_duration_seconds, display_weight)",
      )
      .eq("event_id", eventId),
    supabase
      .from("sponsors")
      .select("id, business_name, category")
      .eq("organization_id", orgId)
      .eq("active", true)
      .order("business_name"),
    supabase
      .from("sponsor_packages")
      .select("id, name, display_duration_seconds, display_weight, active")
      .eq("organization_id", orgId)
      .order("sort_order")
      .order("name"),
  ]);
  for (const r of [sponsorships, sponsors, packages]) if (r.error) throw new Error(r.error.message);

  const rows: EventSponsorshipRow[] = ((sponsorships.data ?? []) as unknown as RawRow[])
    .map((r) => ({
      id: r.id,
      sponsorId: r.sponsor_id,
      packageId: r.package_id,
      sponsorName: r.sponsors?.business_name ?? "Unknown sponsor",
      category: r.sponsors?.category ?? null,
      packageName: r.sponsor_packages?.name ?? "Unknown package",
      exclusive: r.category_exclusive,
      durationOverride: r.display_duration_override,
      weightOverride: r.display_weight_override,
      display: r.sponsor_packages ? effectiveDisplay(r.sponsor_packages, r) : null,
      active: r.active,
    }))
    .sort((a, b) => a.sponsorName.localeCompare(b.sponsorName));

  const attached = new Set(rows.map((r) => r.sponsorId));
  const available = (sponsors.data ?? []).filter((s) => !attached.has(s.id));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sponsors"
        description={`The sponsors at ${event.name}, the package each one bought, and how often it shows on the venue display.`}
        breadcrumb={<AdminBreadcrumb items={eventCrumbs(event, { label: "Sponsors" })} />}
      />
      <EventSponsorsTable
        eventId={eventId}
        rows={rows}
        availableSponsors={available}
        packages={packages.data ?? []}
      />
    </div>
  );
}
