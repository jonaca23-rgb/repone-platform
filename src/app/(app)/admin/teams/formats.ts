import type { EntryFormat } from "@/lib/db/database.types";

export const ENTRY_FORMAT_LABELS: Record<EntryFormat, string> = {
  pair: "Pair",
  team: "Team",
  custom: "Custom format",
};

export const ENTRY_FORMAT_OPTIONS = Object.entries(ENTRY_FORMAT_LABELS) as [EntryFormat, string][];
