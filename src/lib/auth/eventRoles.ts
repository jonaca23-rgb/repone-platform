import { createClient } from "@/lib/db/server";
import type { SessionContext } from "@/lib/auth/session";
import {
  assignedEvents,
  eventAccess,
  type AssignedEvent,
  type EventStaffRole,
} from "@/lib/auth/authorize";

// Event-scoped staff assignment checks (0024_event_role_assignments.sql) —
// Scorekeeper/Producer/Commentator are per-event, unlike org roles, which
// are the org-wide BetterAuth `member` row (see orgCan in authorize.ts). These are
// app-layer convenience for deciding what to render/redirect; the actual
// write authorization always happens in Postgres RLS via the matching
// is_event_scorekeeper()/is_event_producer()/is_event_commentator() SQL
// functions, same division of labor as getSessionContext/has_role.
//
// An admin always passes every one of these checks below — admin has
// unrestricted access to every event, per spec — without needing an
// assignment row of their own.

export type { EventStaffRole } from "@/lib/auth/authorize";

/**
 * Is this signed-in staff member allowed onto `eventId`'s screens for
 * `role`? True for an org manager, an org role holding the role's
 * permission, or an active assignment that opens it (a producer
 * assignment opens the scorekeeper and commentator screens too).
 */
export async function isAssignedToEvent(
  ctx: SessionContext | null,
  eventId: string,
  role: EventStaffRole,
): Promise<boolean> {
  // Same decision the server actions make (authorize.ts, eventAccess).
  return (await eventAccess(await createClient(), ctx, eventId, [role])) !== null;
}

export type { AssignedEvent } from "@/lib/auth/authorize";

/** Events to offer on a staff module's picker (authorize.ts, assignedEvents). */
export async function getAssignedEvents(
  ctx: SessionContext | null,
  role: EventStaffRole,
): Promise<AssignedEvent[]> {
  return assignedEvents(await createClient(), ctx, role);
}
