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
import type { Database } from "@/lib/db/database.types";
import { type OrgRole, type Permissions, roleCan, splitRoles } from "@/lib/auth/permissions";

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

export type EventStaffRole = "scorekeeper" | "producer" | "commentator";

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
 * organization, or for anyone holding an active assignment on the event in
 * one of `staff` (checked with the same SQL functions RLS uses). Pass `[]`
 * for manager-only actions. Returns the event's ids, or null when denied or
 * the event doesn't exist.
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

  for (const role of staff) {
    const { data } = await db.rpc(STAFF_CHECK[role], { p_event_id: event.id });
    if (data === true) return granted;
  }
  return null;
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
