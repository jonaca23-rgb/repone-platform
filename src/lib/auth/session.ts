import { createClient } from "@/lib/db/server";
import type { UserRoleDb } from "@/lib/db/database.types";

export interface SessionContext {
  userId: string;
  email: string | null;
  organizationId: string | null;
  roles: UserRoleDb[];
}

/**
 * Loads the signed-in user plus their organization/roles. Returns null if
 * nobody is signed in. This is a convenience for pages/actions to decide what
 * to render — the actual write authorization always happens in Postgres RLS
 * (see supabase/migrations/0002_rls_and_realtime.sql), so a bug here can make
 * the UI show the wrong thing but can never grant a write RLS would deny.
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  return {
    userId: user.id,
    email: user.email ?? null,
    organizationId: profile?.organization_id ?? null,
    roles: (roleRows ?? []).map((r) => r.role),
  };
}

export function hasAnyRole(ctx: SessionContext | null, roles: UserRoleDb[]): boolean {
  if (!ctx) return false;
  return ctx.roles.some((r) => roles.includes(r));
}

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
