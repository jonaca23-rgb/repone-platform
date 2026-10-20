import { createClient } from "@/lib/db/server";
import { effectiveDisplay } from "@/lib/sponsors/effective";

// A sponsor is one org-level record; what it bought for an event is its
// event_sponsorships row (package + optional overrides, 0032). Every surface
// that lists an event's sponsors reads them through getEventSponsors.

export const EVENT_SPONSOR_SELECT =
  "id, display_duration_override, display_weight_override, sponsors(id, business_name, logo_url, active, sponsor_creatives(id, public_url, active, created_at)), sponsor_packages(id, name, display_enabled, display_duration_seconds, display_weight)";

export interface RawSponsorshipRow {
  id: string;
  display_duration_override: number | null;
  display_weight_override: number | null;
  sponsors: {
    id: string;
    business_name: string;
    logo_url: string | null;
    active: boolean;
    sponsor_creatives: Array<{
      id: string;
      public_url: string;
      active: boolean;
      created_at: string;
    }>;
  } | null;
  sponsor_packages: {
    id: string;
    name: string;
    display_enabled: boolean;
    display_duration_seconds: number;
    display_weight: number;
  } | null;
}

export interface EventSponsor {
  sponsorshipId: string;
  sponsorId: string;
  businessName: string;
  logoUrl: string | null;
  packageId: string;
  packageName: string;
  display: { enabled: boolean; durationSeconds: number; weight: number };
  creatives: Array<{ id: string; url: string }>;
}

/** What a broadcast surface (the production board, the overlays) needs of a sponsor. */
export interface BroadcastSponsor {
  id: string;
  business_name: string;
  logo_url: string | null;
  packageName: string;
}

/** Null when the sponsor is switched off or the package can't be read. */
export function toEventSponsor(r: RawSponsorshipRow): EventSponsor | null {
  if (!r.sponsors?.active || !r.sponsor_packages) return null;
  return {
    sponsorshipId: r.id,
    sponsorId: r.sponsors.id,
    businessName: r.sponsors.business_name,
    logoUrl: r.sponsors.logo_url,
    packageId: r.sponsor_packages.id,
    packageName: r.sponsor_packages.name,
    display: effectiveDisplay(r.sponsor_packages, r),
    creatives: r.sponsors.sponsor_creatives
      .filter((c) => c.active)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((c) => ({ id: c.id, url: c.public_url })),
  };
}

export function toBroadcastSponsor(s: EventSponsor): BroadcastSponsor {
  return {
    id: s.sponsorId,
    business_name: s.businessName,
    logo_url: s.logoUrl,
    packageName: s.packageName,
  };
}

/** Every active sponsor of an event, by name. */
export async function getEventSponsors(eventId: string): Promise<EventSponsor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_sponsorships")
    .select(EVENT_SPONSOR_SELECT)
    .eq("event_id", eventId)
    .eq("active", true);
  if (error) throw new Error(error.message);
  // See lib/db/queries.ts: many-to-one embeds come back typed loosely.
  return ((data ?? []) as unknown as RawSponsorshipRow[])
    .map(toEventSponsor)
    .filter((s): s is EventSponsor => s !== null)
    .sort((a, b) => a.businessName.localeCompare(b.businessName));
}
