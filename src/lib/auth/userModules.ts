import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { getAuthSession, getSessionContext } from "@/lib/auth/session";
import { modulesFor, type Module, type ModuleKind } from "@/lib/auth/modules";
import { createClient } from "@/lib/db/server";

/** This request's modules (spec §4). Empty when signed out. */
export const userModules = cache(async (): Promise<Module[]> => {
  const ctx = await getSessionContext();
  if (!ctx) return [];
  const supabase = await createClient();
  const active = (table: "event_scorekeeper_assignments" | "event_producer_assignments" | "event_commentator_assignments", column: string) =>
    supabase.from(table).select("events(name)").eq(column, ctx.userId).eq("status", "active");

  const [org, sk, pr, co, athlete] = await Promise.all([
    ctx.organizationId
      ? supabase.from("organizations").select("name").eq("id", ctx.organizationId).maybeSingle()
      : Promise.resolve({ data: null }),
    active("event_scorekeeper_assignments", "scorekeeper_user_id"),
    active("event_producer_assignments", "producer_user_id"),
    active("event_commentator_assignments", "commentator_user_id"),
    supabase.from("athletes").select("first_name, last_name").eq("auth_user_id", ctx.userId).maybeSingle(),
  ]);
  // See lib/db/queries.ts header comment: many-to-one embeds come back as single objects.
  const names = (rows: unknown) =>
    ((rows ?? []) as Array<{ events: { name: string } | null }>).flatMap((r) => (r.events ? [r.events.name] : []));

  return modulesFor({
    orgName: org.data?.name ?? null,
    orgRoles: ctx.roles,
    assignments: { scorekeeper: names(sk.data), producer: names(pr.data), commentator: names(co.data) },
    athleteName: athlete.data ? `${athlete.data.first_name} ${athlete.data.last_name}` : null,
  });
});

/** Layout guard: signed out → /login; none of `kinds` → / (which never redirects into a module you lack). */
export async function requireModule(...kinds: ModuleKind[]): Promise<void> {
  if (!(await getAuthSession())) redirect("/login");
  const mine = await userModules();
  if (!mine.some((m) => kinds.includes(m.kind))) redirect("/");
}
