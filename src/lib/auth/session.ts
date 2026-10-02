import { headers } from "next/headers";
import { cache } from "react";
import { auth } from "@/lib/auth/server";
import { createClient } from "@/lib/db/server";
import { loadSessionContext, type SessionContext } from "@/lib/auth/authorize";

export { orgCan, type SessionContext } from "@/lib/auth/authorize";

/**
 * Who the BetterAuth session cookie says is signed in, or null. Cached for the
 * request: createClient() mints its token from it, and every guard asks it.
 */
export const getAuthSession = cache(
  async (): Promise<{ userId: string; email: string; name: string } | null> => {
    const s = await auth.api.getSession({ headers: await headers() });
    return s ? { userId: s.user.id, email: s.user.email, name: s.user.name } : null;
  },
);

/**
 * The signed-in user plus their organization/roles, or null. Cached for the
 * request: layouts, pages and actions all call this, and it used to re-run
 * its three queries every time. Authorization decisions for actions live in
 * guards.ts / authorize.ts; RLS remains the last line of defense.
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const identity = await getAuthSession();
  return loadSessionContext(await createClient(), identity);
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
 * 0010_athlete_open_log.sql) — same BetterAuth user table, but an
 * athlete is not an org member, so
 * getSessionContext() above naturally treats them as signed-in-but-no-role,
 * which already keeps them out of /admin/*. This is the athlete-side
 * equivalent: it looks up their linked `athletes` row (if any) instead of a
 * staff profile.
 */
export async function getAthleteSessionContext(): Promise<AthleteSessionContext | null> {
  const user = await getAuthSession();
  if (!user) return null;
  const supabase = await createClient();

  const { data: athlete } = await supabase
    .from("athletes")
    .select("id, first_name, last_name, organization_id")
    .eq("auth_user_id", user.userId)
    .maybeSingle();

  return {
    userId: user.userId,
    email: user.email,
    athleteId: athlete?.id ?? null,
    organizationId: athlete?.organization_id ?? null,
    firstName: athlete?.first_name ?? null,
    lastName: athlete?.last_name ?? null,
  };
}
