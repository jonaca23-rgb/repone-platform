import { createClient } from "@/lib/db/server";
import {
  eventAccess,
  floorEventId,
  heatScope,
  orgManagerOf,
  type EventStaffRole,
  type SessionContext,
} from "@/lib/auth/authorize";
import { getSessionContext } from "@/lib/auth/session";

// Guards for server actions: call one at the top of every action that
// changes data. Each resolves ownership on the server (event of a floor or
// heat, org of an event) instead of trusting ids the browser sends, and
// throws NotAuthorizedError with a message fit to show the user.

export class NotAuthorizedError extends Error {
  constructor(message = "You don't have access to do that.") {
    super(message);
    this.name = "NotAuthorizedError";
  }
}

export async function requireSignedIn(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) throw new NotAuthorizedError("Please sign in again.");
  return ctx;
}

/** Someone whose org role grants event:update (owner, admin, event director); returns their organization. */
export async function requireOrgManager() {
  const ctx = await requireSignedIn();
  const organizationId = orgManagerOf(ctx);
  if (!organizationId) {
    throw new NotAuthorizedError("Only an admin or event director can do that.");
  }
  return { ctx, organizationId };
}

/**
 * A manager of the event's organization, or event staff assigned in one of
 * `staff` (default: managers only).
 */
export async function requireEventAccess(eventId: string, staff: EventStaffRole[] = []) {
  const ctx = await requireSignedIn();
  const access = await eventAccess(await createClient(), ctx, eventId, staff);
  if (!access) throw new NotAuthorizedError("You don't have access to this event.");
  return { ctx, ...access };
}

/** Access to the event a floor belongs to (e.g. a producer driving it). */
export async function requireFloorAccess(floorId: string, staff: EventStaffRole[]) {
  const eventId = await floorEventId(await createClient(), floorId);
  if (!eventId) throw new NotAuthorizedError("That floor doesn't exist.");
  return { ...(await requireEventAccess(eventId, staff)), floorId };
}

/** Access to a heat's event; returns the heat's server-side event/WOD/division/floor. */
export async function requireHeatAccess(heatId: string, staff: EventStaffRole[]) {
  const heat = await heatScope(await createClient(), heatId);
  if (!heat) throw new NotAuthorizedError("That heat doesn't exist.");
  return { ...(await requireEventAccess(heat.event_id, staff)), heat };
}

/**
 * For update/delete calls chained with `.select("id")`: an error, or no rows
 * changed (wrong id, or RLS refused), becomes an error instead of "success".
 */
export function expectChanged<T>(
  res: { data: T[] | null; error: { message: string } | null },
  what: string,
): T[] {
  if (res.error) throw new Error(`Couldn't ${what}: ${res.error.message}`);
  if (!res.data?.length) throw new NotAuthorizedError(`Couldn't ${what}: not found, or not yours.`);
  return res.data;
}
