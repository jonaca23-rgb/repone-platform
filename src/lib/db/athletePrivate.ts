import type { createClient } from "@/lib/db/server";

export interface AthletePrivateDetails {
  email: string;
  phone: string | null;
  dateOfBirth: string | null;
}

/**
 * Email, phone and date of birth are not selectable from `athletes` directly
 * (0025_security_hardening.sql): they come from athlete_private_details(),
 * which returns rows only for org staff, event-assigned staff, or the athlete
 * themselves. Anyone else gets an empty map, so callers render "unknown"
 * (e.g. no age category) rather than failing.
 */
export async function getAthletePrivateDetails(
  supabase: Awaited<ReturnType<typeof createClient>>,
  athleteIds: string[],
): Promise<Map<string, AthletePrivateDetails>> {
  const details = new Map<string, AthletePrivateDetails>();
  if (athleteIds.length === 0) return details;

  const { data, error } = await supabase.rpc("athlete_private_details", {
    p_athlete_ids: athleteIds,
  });
  if (error) throw new Error(error.message);

  for (const row of (data ?? []) as Array<{
    id: string;
    email: string;
    phone: string | null;
    date_of_birth: string | null;
  }>) {
    details.set(row.id, { email: row.email, phone: row.phone, dateOfBirth: row.date_of_birth });
  }
  return details;
}
