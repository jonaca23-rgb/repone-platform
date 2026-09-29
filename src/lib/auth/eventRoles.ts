import { createClient } from "@/lib/db/server";
import { hasAnyRole, type SessionContext } from "@/lib/auth/session";

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

export type EventStaffRole = "scorekeeper" | "producer" | "commentator";

const ASSIGNMENT_TABLE: Record<EventStaffRole, string> = {
  scorekeeper: "event_scorekeeper_assignments",
  producer: "event_producer_assignments",
  commentator: "event_commentator_assignments",
};

const ASSIGNMENT_USER_COLUMN: Record<EventStaffRole, string> = {
  scorekeeper: "scorekeeper_user_id",
  producer: "producer_user_id",
  commentator: "commentator_user_id",
};

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
  if (!ctx) return false;
  if (hasAnyRole(ctx, ["admin"])) return true;

  const supabase = await createClient();
  const { data } = await supabase
    .from(ASSIGNMENT_TABLE[role])
    .select("id")
    .eq("event_id", eventId)
    .eq(ASSIGNMENT_USER_COLUMN[role], ctx.userId)
    .eq("status", "active")
    .maybeSingle();

  return !!data;
}

export interface AssignedEvent {
  id: string;
  name: string;
  status: string;
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

  const { data: assignments } = await supabase
    .from(ASSIGNMENT_TABLE[role])
    .select(`event_id, events(id, name, status, starts_on, ends_on)`)
    .eq(ASSIGNMENT_USER_COLUMN[role], ctx.userId)
    .eq("status", "active");

  // See lib/db/queries.ts header comment — our untyped Supabase client can't
  // infer that a many-to-one embed comes back as one object, not an array.
  const rows = (assignments ?? []) as unknown as Array<{ events: AssignedEvent | null }>;
  return rows.map((r) => r.events).filter((e): e is AssignedEvent => !!e);
}
