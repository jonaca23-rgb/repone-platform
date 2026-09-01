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
