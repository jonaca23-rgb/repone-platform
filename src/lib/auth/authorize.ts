// Authorization decisions for server actions. Every function takes the
// Supabase client it should ask with, so the same logic runs in the app
// (through guards.ts, with the request's token client) and in
// scripts/authz-check.ts (with a client signed in as each dev account).
// No Next.js imports here on purpose.
//
// Postgres RLS remains the last line of defense. These checks exist so an
// action refuses up front with a clear error instead of relying on RLS, whose
// denials look like success (an update that matches 0 rows).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, EventStatus } from "@/lib/db/database.types";
import {
  assignmentsOpening,
  type EventStaffKind,
  type OrgRole,
  type Permissions,
  roleCan,
  splitRoles,
  STAFF_PERMISSION,
} from "@/lib/auth/permissions";

type Db = SupabaseClient<Database>;

/**
 * Who is signed in and their org roles, from their BetterAuth `member` row
 * (0029). Event-only staff and athletes are not members: no org, no roles.
 */
export interface SessionContext {
  userId: string;
  email: string | null;
  organizationId: string | null;
  roles: OrgRole[];
}

export type EventStaffRole = EventStaffKind;

/** Who is signed in, as the BetterAuth session says (or a script's sign-in). */
export interface SessionIdentity {
  userId: string;
  email: string | null;
}

/**
 * The organization and roles of `identity`, read with `db` (a client carrying
 * that identity's minted token, so RLS lets it see its own rows). Null when
 * nobody is signed in.
 */
export async function loadSessionContext(
  db: Db,
  identity: SessionIdentity | null,
): Promise<SessionContext | null> {
  if (!identity) return null;

  const { data: memberships } = await db
    .from("member")
    .select("organization_id, role, created_at")
    .eq("user_id", identity.userId)
    .order("created_at", { ascending: true });
  // RepOne runs one organization; the first membership is it.
  const first = memberships?.[0];

  return {
    userId: identity.userId,
    email: identity.email,
    organizationId: first?.organization_id ?? null,
    roles: splitRoles(first?.role),
  };
}

/** Does this person's org role grant `permissions`? (Event assignments are checked by eventAccess.) */
export function orgCan(ctx: SessionContext | null, permissions: Permissions): boolean {
  return !!ctx?.organizationId && roleCan(ctx.roles, permissions);
}

/** The organization this person manages (event:update), or null. */
export function orgManagerOf(ctx: SessionContext | null): string | null {
  return orgCan(ctx, { event: ["update"] }) ? ctx!.organizationId : null;
}

const STAFF_CHECK = {
  scorekeeper: "is_event_scorekeeper",
  producer: "is_event_producer",
  commentator: "is_event_commentator",
} as const;

/**
 * May this user act on `eventId`? Yes for a manager of the event's own
 * organization; for each staff kind in `staff`, also for an org role in the
 * event's organization holding that kind's permission (STAFF_PERMISSION), or
 * an active assignment on the event whose role holds it (assignmentsOpening;
 * checked with the same SQL functions RLS uses). This is the spec's
 * can(ctx, permissions, eventId). Pass `[]` for manager-only actions.
 * Returns the event's ids, or null when denied or the event doesn't exist.
 */
export async function eventAccess(
  db: Db,
  ctx: SessionContext | null,
  eventId: string,
  staff: EventStaffRole[],
): Promise<{ eventId: string; organizationId: string } | null> {
  if (!ctx) return null;
  const { data: event } = await db
    .from("events")
    .select("id, organization_id")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return null;
  const granted = { eventId: event.id, organizationId: event.organization_id };

  if (orgManagerOf(ctx) === event.organization_id) return granted;

  if (
    ctx.organizationId === event.organization_id &&
    staff.some((kind) => roleCan(ctx.roles, STAFF_PERMISSION[kind]))
  )
    return granted;

  const kinds = new Set(staff.flatMap(assignmentsOpening));
  for (const kind of kinds) {
    const { data } = await db.rpc(STAFF_CHECK[kind], { p_event_id: event.id });
    if (data === true) return granted;
  }
  return null;
}

const ASSIGNMENT = {
  scorekeeper: { table: "event_scorekeeper_assignments", column: "scorekeeper_user_id" },
  producer: { table: "event_producer_assignments", column: "producer_user_id" },
  commentator: { table: "event_commentator_assignments", column: "commentator_user_id" },
} as const;

export interface AssignedEvent {
  id: string;
  name: string;
  status: EventStatus;
  starts_on: string | null;
  ends_on: string | null;
}

/**
 * Events to offer on a staff module's picker: every scheduled/live event in
 * the org for an org manager or an org role holding the kind's permission;
 * otherwise the events this user holds an active assignment for that opens
 * the kind (a producer's events show on the Scorekeeper picker too).
 */
export async function assignedEvents(
  db: Db,
  ctx: SessionContext | null,
  role: EventStaffRole,
): Promise<AssignedEvent[]> {
  if (!ctx) return [];

  if (orgCan(ctx, { event: ["update"] }) || orgCan(ctx, STAFF_PERMISSION[role])) {
    const { data } = await db
      .from("events")
      .select("id, name, status, starts_on, ends_on")
      .eq("organization_id", ctx.organizationId ?? "")
      .in("status", ["scheduled", "live"])
      .order("starts_on", { ascending: true, nullsFirst: false });
    return data ?? [];
  }

  const lists = await Promise.all(
    assignmentsOpening(role).map(async (kind) => {
      // The three assignment tables share every column except the user id
      // one, so the scorekeeper table's types stand in for all three.
      const { table, column } = ASSIGNMENT[kind];
      const { data: rows } = await db
        .from(table as "event_scorekeeper_assignments")
        .select(`event_id, events(id, name, status, starts_on, ends_on)`)
        .eq(column as "scorekeeper_user_id", ctx.userId)
        .eq("status", "active");
      return (rows ?? []).map((r) => r.events).filter((e): e is AssignedEvent => !!e);
    }),
  );
  const byId = new Map(lists.flat().map((e) => [e.id, e]));
  return [...byId.values()];
}

/** The event a floor belongs to (floor → venue → event), or null. */
export async function floorEventId(db: Db, floorId: string): Promise<string | null> {
  const { data } = await db
    .from("floors")
    .select("venues(event_id)")
    .eq("id", floorId)
    .maybeSingle();
  return data?.venues?.event_id ?? null;
}

/**
 * Everything a heat pins down, read on the server so actions never trust the
 * event / WOD / division / floor ids a browser sends alongside a heat id.
 */
export async function heatScope(db: Db, heatId: string) {
  const { data } = await db
    .from("heats")
    .select("id, event_id, wod_id, division_id, floor_id")
    .eq("id", heatId)
    .maybeSingle();
  return data;
}
