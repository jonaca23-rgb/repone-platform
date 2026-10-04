import type { SponsorTier } from "@/lib/db/database.types";

/** RepOneLive's sponsor inventory, with its prices. */
export const TIER_LABELS: Record<SponsorTier, string> = {
  logo_sponsor: "Logo Sponsor — $50/event",
  brand_mention: "Brand Mention — $75/event",
  commercial_30: "Commercial 30 — $90 (3x :30)",
  commercial_30_plus: "Commercial 30 Plus — $150 (6x :30)",
  wod_sponsor: "WOD Sponsor — $200",
  presenting_sponsor: "Presenting Sponsor — $450",
};

export const TIER_OPTIONS = Object.entries(TIER_LABELS) as [SponsorTier, string][];
