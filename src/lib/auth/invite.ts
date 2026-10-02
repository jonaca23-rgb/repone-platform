import type { SupabaseClient } from "@supabase/supabase-js";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { member, user } from "@/db/schema";
// auth.ts, not ./server: scripts/invite-check.ts imports this module under tsx,
// where the server-only guard throws. App code reaches it only from the server:
// the "use server" actions (lib/actions/team.ts, eventStaff.ts) and the event
// staff page, a Server Component.
import { auth } from "@/lib/auth/auth";
import { roleGrantedEmail } from "@/lib/auth/emails";
import { sendPasswordLink } from "@/lib/auth/passwordLink";
import { splitRoles, type OrgRole } from "@/lib/auth/permissions";
import type { Database } from "@/lib/db/database.types";
import { sendEmail } from "@/lib/mailer";

/**
 * Invitations, as in school-schedule (actions/people.ts): the person is
 * created verified and without a password, given the role, and emailed a
 * password link (/invite). BetterAuth's own inviteMember would make them sign
 * up first and then accept; its route is closed (auth.ts,
 * beforeCreateInvitation). Callers authorize the inviter; inviteToOrg also
 * asks BetterAuth (member:create) because it grants org roles.
 *
 * Reads "user" and member over the owner connection (@/db), which the API
 * cannot read; eslint.config.mjs allows this file that.
 */
export type InviteOutcome = { userId: string; created: boolean; emailSent: boolean };

/** A refusal meant for the inviter to read (the actions show its message inline). */
export class InviteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InviteError";
  }
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** The account for `email`, created verified and without a password when missing. */
export async function ensureUser(email: string): Promise<{ userId: string; created: boolean }> {
  const address = normalizeEmail(email);
  const [found] = await db
    .select({ id: user.id })
    .from(user)
    .where(sql`lower(${user.email}) = ${address}`);
  if (found) return { userId: found.id, created: false };
  // No headers: the admin plugin skips its own permission check (installed
  // 1.7.6 behaviour); the caller has already authorized the inviter.
  const { user: created } = await auth.api.createUser({
    body: { email: address, name: "", data: { emailVerified: true } },
  });
  return { userId: created.id, created: true };
}

/**
 * Sends the invitation or the access notice; false if it didn't go out.
 *
 * Anyone who has never signed in gets the invitation (a password link), not
 * just a new account: a re-invite after the email failed, an event invite for
 * someone whose team invitation is still pending, or an account left behind
 * when granting the role failed all have no way in without it.
 */
async function deliver(created: boolean, userId: string, email: string, what: string): Promise<boolean> {
  const address = normalizeEmail(email);
  try {
    if (created || (await pendingEmail(userId)) !== null) await sendPasswordLink(userId, address);
    else
      await sendEmail(
        roleGrantedEmail({ to: address, what, loginUrl: `${process.env.BETTER_AUTH_URL}/login` }),
      );
    return true;
  } catch (error) {
    // The admin can't fix delivery; the cause goes to the server logs and the
    // action tells them to use Resend.
    console.error("invite: the email was not sent", error);
    return false;
  }
}

export async function inviteToOrg(input: {
  email: string;
  role: OrgRole;
  organizationId: string;
  orgName: string;
  headers: Headers;
}): Promise<InviteOutcome> {
  if (input.role === "owner") throw new InviteError("Ownership is transferred, not granted by invitation.");
  const allowed = await auth.api.hasPermission({
    headers: input.headers,
    body: { organizationId: input.organizationId, permissions: { member: ["create"] } },
  });
  if (!allowed.success) throw new InviteError("Only an owner or admin can invite to the team.");

  const { userId, created } = await ensureUser(input.email);
  const [existing] = await db
    .select({ id: member.id, role: member.role })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.organizationId, input.organizationId)));
  if (!existing) {
    // Server-only and unchecked by BetterAuth: authorized above.
    await auth.api.addMember({
      body: { userId, role: input.role, organizationId: input.organizationId },
    });
  } else if (!splitRoles(existing.role).includes(input.role)) {
    // With the inviter's headers: the plugin applies its own rules too.
    await auth.api.updateMemberRole({
      headers: input.headers,
      body: {
        memberId: existing.id,
        role: [...splitRoles(existing.role), input.role],
        organizationId: input.organizationId,
      },
    });
  }
  const emailSent = await deliver(
    created,
    userId,
    input.email,
    `${input.role.replaceAll("_", " ")} at ${input.orgName}`,
  );
  return { userId, created, emailSent };
}

const ASSIGNMENT = {
  scorekeeper: { table: "event_scorekeeper_assignments", column: "scorekeeper_user_id" },
  producer: { table: "event_producer_assignments", column: "producer_user_id" },
  commentator: { table: "event_commentator_assignments", column: "commentator_user_id" },
} as const;

export type EventInviteKind = keyof typeof ASSIGNMENT;

export async function inviteToEvent(input: {
  email: string;
  kind: EventInviteKind;
  eventId: string;
  eventName: string;
  invitedBy: string;
  roleLabel?: string | null;
  /** The inviter's client (defaults to the request's). RLS "managers manage … assignments" decides. */
  db?: SupabaseClient<Database>;
}): Promise<InviteOutcome> {
  const { userId, created } = await ensureUser(input.email);
  const { table, column } = ASSIGNMENT[input.kind];
  // Loaded only when needed: @/lib/db/server reads next/headers, which a
  // script (which passes its own client) must not load.
  const supabase = input.db ?? (await (await import("@/lib/db/server")).createClient());
  // Re-inviting someone previously removed flips their existing row back to
  // active (unique(event_id, <role>_user_id)).
  const { error } = await supabase.from(table).upsert(
    {
      event_id: input.eventId,
      [column]: userId,
      assigned_by_admin_id: input.invitedBy,
      status: "active",
      assigned_at: new Date().toISOString(),
      removed_at: null,
      ...(input.kind === "commentator" ? { role_label: input.roleLabel ?? null } : {}),
    } as never,
    { onConflict: `event_id,${column}` },
  );
  if (error) throw new Error(error.message);
  const emailSent = await deliver(created, userId, input.email, `${input.kind} for ${input.eventName}`);
  return { userId, created, emailSent };
}

/** Sends a fresh password link; throws if it didn't go out. */
export async function resendInvitation(userId: string, email: string): Promise<void> {
  await sendPasswordLink(userId, normalizeEmail(email));
}

/** People who have never signed in: their invitation is still pending. */
export async function isPending(userIds: string[]): Promise<Set<string>> {
  if (!userIds.length) return new Set();
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(and(inArray(user.id, userIds), isNull(user.lastSignInAt)));
  return new Set(rows.map((r) => r.id));
}

/** The email of someone who has never signed in, or null (unknown, or already signed in). */
export async function pendingEmail(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ email: user.email })
    .from(user)
    .where(and(eq(user.id, userId), isNull(user.lastSignInAt)));
  return row?.email ?? null;
}

/**
 * Emails for people the caller already lists (event staff, who need not be org
 * members, so org_member_emails can't name them). The caller authorizes the
 * viewer: only someone who may invite staff to that event sees them.
 */
export async function emailsByUserId(userIds: string[]): Promise<Map<string, string>> {
  if (!userIds.length) return new Map();
  const rows = await db.select({ id: user.id, email: user.email }).from(user).where(inArray(user.id, userIds));
  return new Map(rows.map((r) => [r.id, r.email]));
}
