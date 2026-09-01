import type { SponsorTier } from "@/lib/db/database.types";

export const SPONSOR_TIER_LABELS: Record<SponsorTier, string> = {
  logo_sponsor: "Logo Sponsor",
  brand_mention: "Brand Mention",
  commercial_30: "Commercial 30",
  commercial_30_plus: "Commercial 30 Plus",
  wod_sponsor: "WOD Sponsor",
  presenting_sponsor: "Presenting Sponsor",
};
