import type { CompetitorEntryType } from "@/lib/db/database.types";

export const ENTRY_TYPE_LABELS: Record<CompetitorEntryType, string> = {
  individual: "Individual",
  pair: "Pair",
  team: "Team",
  custom: "Custom format",
};

export const ENTRY_TYPE_OPTIONS = Object.entries(ENTRY_TYPE_LABELS) as [
  CompetitorEntryType,
  string,
][];
