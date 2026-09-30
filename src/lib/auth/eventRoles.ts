import { createClient } from "@/lib/db/server";
import { hasAnyRole, type SessionContext } from "@/lib/auth/session";
import { eventAccess, type EventStaffRole } from "@/lib/auth/authorize";
import type { EventStatus } from "@/lib/db/database.types";

// Event-scoped staff assignment checks (0024_event_role_assignments.sql) —
// Scorekeeper/Producer/Commentator are per-event, unlike Admin, which stays
// the org-wide `user_roles` row (see hasAnyRole in session.ts). These are
// app-layer convenience for deciding what to render/redirect; the actual
// write authorization always happens in Postgres RLS via the matching
// is_event_scorekeeper()/is_event_producer()/is_event_commentator() SQL
// functions, same division of labor as getSessionContext/has_role.
//
// An admin always passes every one of these checks below — admin has
// unrestricted access to every event, per spec — without needing an
// assignment row of their own.

export type { EventStaffRole } from "@/lib/auth/authorize";

const ASSIGNMENT_TABLE = {
  scorekeeper: "event_scorekeeper_assignments",
  producer: "event_producer_assignments",
  commentator: "event_commentator_assignments",
} as const;

const ASSIGNMENT_USER_COLUMN = {
  scorekeeper: "scorekeeper_user_id",
  producer: "producer_user_id",
  commentator: "commentator_user_id",
} as const;

/**
 * Is this signed-in staff member allowed onto `eventId`'s screens for
 * `role`? True for an admin unconditionally, or for anyone with an
 * `active` assignment row for that event/role.
 */
export async function isAssignedToEvent(
  ctx: SessionContext | null,
  eventId: string,
  role: EventStaffRole,
): Promise<boolean> {
  // Same decision the server actions make (authorize.ts): a manager of the
  // event's org, or active staff assigned in this role.
  return (await eventAccess(await createClient(), ctx, eventId, [role])) !== null;
}

// The three assignment tables share every column except the user id one, so
// the scorekeeper table's types stand in for all three in the query builder.
// This is the one place that bridges the dynamic table name.
function assignments(supabase: Awaited<ReturnType<typeof createClient>>, role: EventStaffRole) {
  return {
    table: supabase.from(ASSIGNMENT_TABLE[role] as "event_scorekeeper_assignments"),
    userColumn: ASSIGNMENT_USER_COLUMN[role] as "scorekeeper_user_id",
  };
}

export interface AssignedEvent {
  id: string;
  name: string;
  status: EventStatus;
  starts_on: string | null;
  ends_on: string | null;
}

/**
 * Events to offer on a staff role's landing page: every scheduled/live
 * event in the org for an admin (same as today's floor pickers), or just
 * the events this specific user holds an active assignment for otherwise.
 */
export async function getAssignedEvents(
  ctx: SessionContext | null,
  role: EventStaffRole,
): Promise<AssignedEvent[]> {
  if (!ctx) return [];
  const supabase = await createClient();

  if (hasAnyRole(ctx, ["admin"])) {
    const { data } = await supabase
      .from("events")
      .select("id, name, status, starts_on, ends_on")
      .eq("organization_id", ctx.organizationId ?? "")
      .in("status", ["scheduled", "live"])
      .order("starts_on", { ascending: true, nullsFirst: false });
    return data ?? [];
  }

  const { table, userColumn } = assignments(supabase, role);
  const { data: rows } = await table
    .select(`event_id, events(id, name, status, starts_on, ends_on)`)
    .eq(userColumn, ctx.userId)
    .eq("status", "active");

  return (rows ?? []).map((r) => r.events).filter((e): e is AssignedEvent => !!e);
}

/** Roles allowed into /admin. Everyone else is sent to staffLandingPath(). */
export const ADMIN_AREA_ROLES = ["admin", "event_director"] as const;

/**
 * Where a signed-in user belongs when they reach a staff screen they can't
 * use (e.g. /admin, which every staff login lands on first): their first
 * event assignment's screen, else their athlete portal, else the home page.
 * Never returns /admin, so redirecting to it can't loop.
 */
export async function staffLandingPath(ctx: SessionContext): Promise<string> {
  const roleHome: Record<EventStaffRole, string> = {
    scorekeeper: "/scorekeeper",
    producer: "/producer",
    commentator: "/commentator",
  };
  if (hasAnyRole(ctx, ["scoring_operator"])) return roleHome.scorekeeper;
  if (hasAnyRole(ctx, ["production_director"])) return roleHome.producer;
  if (hasAnyRole(ctx, ["commentator"])) return roleHome.commentator;

  const supabase = await createClient();
  for (const role of ["scorekeeper", "producer", "commentator"] as const) {
    const { table, userColumn } = assignments(supabase, role);
    const { data } = await table
      .select("id")
      .eq(userColumn, ctx.userId)
      .eq("status", "active")
      .limit(1);
    if (data?.length) return roleHome[role];
  }

  const { data: athlete } = await supabase
    .from("athletes")
    .select("id")
    .eq("auth_user_id", ctx.userId)
    .maybeSingle();
  return athlete ? "/athlete" : "/";
}
