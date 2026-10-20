import type { createClient } from "@/lib/db/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * The registrations of every team an athlete is on (0036): where a team
 * member's fee is paid and their team's standing hangs. One query: the
 * registration's team is joined again under `member_of` to filter by its
 * members, so `columns` may embed `teams(...)` for itself. Rows come back
 * untyped for the caller to shape, as the embeds' types vary with `columns`.
 */
export async function teamRegistrationsFor(
  supabase: SupabaseServerClient,
  athleteId: string,
  columns: string,
): Promise<unknown[]> {
  const { data, error } = await supabase
    .from("registrations")
    .select(`${columns}, member_of:teams!inner(team_members!inner(athlete_id))`)
    .eq("member_of.team_members.athlete_id", athleteId);
  if (error) throw new Error(error.message);
  return data ?? [];
}
