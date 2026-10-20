import type { Database } from "@/lib/db/supabase.types";

/** What competes in a division: one athlete, or a team of a fixed size (0036). */
export type EntryFormat = Database["public"]["Enums"]["competitor_entry_type"];

export function isTeamFormat(format: EntryFormat): boolean {
  return format !== "individual";
}

/** "Individual", "Pairs", "Teams of 4". */
export function formatLabel(format: EntryFormat, teamSize: number | null): string {
  if (format === "individual") return "Individual";
  if (format === "pair") return "Pairs";
  return teamSize ? `Teams of ${teamSize}` : "Teams";
}
