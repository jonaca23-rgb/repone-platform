import { cache } from "react";
import { createClient } from "@/lib/db/server";
import { loadSessionContext, type SessionContext } from "@/lib/auth/authorize";

export { hasAnyRole, type SessionContext } from "@/lib/auth/authorize";

/**
 * The signed-in user plus their organization/roles, or null. Cached for the
 * request: layouts, pages and actions all call this, and it used to re-run
 * its three queries every time. Authorization decisions for actions live in
 * guards.ts / authorize.ts; RLS remains the last line of defense.
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  return loadSessionContext(await createClient());
});

export interface AthleteSessionContext {
  userId: string;
  email: string | null;
  athleteId: string | null; // null until they've completed onboarding (bootstrap_athlete)
  organizationId: string | null; // same: null until onboarding links an athletes row
  firstName: string | null;
  lastName: string | null;
}

/**
 * Athlete accounts are a separate identity space from staff accounts (see
 * 0010_athlete_open_log.sql) — same Supabase auth.users table, but an
 * athlete never gets a profiles.organization_id or a user_roles row, so
 * getSessionContext() above naturally treats them as signed-in-but-no-role,
 * which already keeps them out of /admin/*. This is the athlete-side
 * equivalent: it looks up their linked `athletes` row (if any) instead of a
 * staff profile.
 */
export async function getAthleteSessionContext(): Promise<AthleteSessionContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: athlete } = await supabase
    .from("athletes")
    .select("id, first_name, last_name, organization_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return {
    userId: user.id,
    email: user.email ?? null,
    athleteId: athlete?.id ?? null,
    organizationId: athlete?.organization_id ?? null,
    firstName: athlete?.first_name ?? null,
    lastName: athlete?.last_name ?? null,
  };
}
