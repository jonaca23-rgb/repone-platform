import type { createClient } from "@/lib/db/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * The registrations of every team an athlete is on (0036): where a team
 * member's fee is paid and their team's standing hangs. `columns` is the
 * caller's select; rows come back untyped for the caller to shape, as the
 * embeds' types vary with it.
 */
export async function teamRegistrationsFor(
  supabase: SupabaseServerClient,
  athleteId: string,
  columns: string,
): Promise<unknown[]> {
  const memberships = await supabase
    .from("team_members")
    .select("team_id")
    .eq("athlete_id", athleteId);
  if (memberships.error) throw new Error(memberships.error.message);
  const teamIds = (memberships.data ?? []).map((m) => m.team_id);
  if (teamIds.length === 0) return [];
  const registrations = await supabase.from("registrations").select(columns).in("team_id", teamIds);
  if (registrations.error) throw new Error(registrations.error.message);
  return registrations.data ?? [];
}
