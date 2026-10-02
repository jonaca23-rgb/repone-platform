"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { expectChanged, NotAuthorizedError, requireEventAccess } from "@/lib/auth/guards";
import { InviteError, inviteToEvent, pendingEmail } from "@/lib/auth/invite";
import { orgCan } from "@/lib/auth/session";
import { failure, inviteMessage, resendMessage, type FormResult } from "@/lib/actions/inviteResult";
import { createClient } from "@/lib/db/server";
import { field, parseArg, parseForm } from "@/lib/validation/form";

// Invite/remove event-scoped Scorekeeper/Producer/Commentator staff
// (0024_event_role_assignments.sql). RLS lets an owner, admin or event
// director of the event's organization write these tables (0029), which is
// the staff:invite permission, so the guard requires both: access to the
// event, and staff:invite. Checking here gives a clear error instead of a
// silent RLS-denied failure. Invitations themselves: lib/auth/invite.ts.
async function requireEventAdmin(eventId: string) {
  const access = await requireEventAccess(eventId);
  if (!orgCan(access.ctx, { staff: ["invite"] }))
    throw new NotAuthorizedError("Only an admin or event director can manage event staff.");
  return access;
}

const TABLE = {
  scorekeeper: "event_scorekeeper_assignments",
  producer: "event_producer_assignments",
  commentator: "event_commentator_assignments",
} as const;

const USER_COLUMN = {
  scorekeeper: "scorekeeper_user_id",
  producer: "producer_user_id",
  commentator: "commentator_user_id",
} as const;

type EventStaffRole = keyof typeof TABLE;
const STAFF_ROLES = Object.keys(TABLE) as [EventStaffRole, ...EventStaffRole[]];

const StaffForm = z.object({ email: field.email() });

const CommentatorForm = StaffForm.extend({
  roleLabel: field.optionalText({ max: 50, label: "Role label" }),
});

/** Invites `email` as this event's `role`: a new account, or access for an existing one. */
export async function inviteEventStaff(
  role: string,
  eventId: string,
  _previous: FormResult,
  formData: FormData,
): Promise<FormResult> {
  try {
    const kind = parseArg(field.oneOf(STAFF_ROLES, "staff role"), role);
    const id = parseArg(field.id("Event"), eventId);
    const { email, roleLabel } =
      kind === "commentator"
        ? parseForm(CommentatorForm, formData)
        : { ...parseForm(StaffForm, formData), roleLabel: null };
    const { ctx } = await requireEventAdmin(id);

    const supabase = await createClient();
    const { data: event } = await supabase.from("events").select("name").eq("id", id).single();
    const outcome = await inviteToEvent({
      email,
      kind,
      eventId: id,
      eventName: event?.name ?? "an event",
      invitedBy: ctx.userId,
      roleLabel,
      db: supabase,
    });
    revalidatePath(`/admin/events/${id}/staff`);
    return inviteMessage(outcome);
  } catch (error) {
    return failure(error);
  }
}

/** A fresh invitation link for someone on this event's staff who has never signed in. */
export async function resendEventInvite(
  eventId: string,
  userId: string,
  _previous: FormResult,
): Promise<FormResult> {
  try {
    const id = parseArg(field.id("Event"), eventId);
    const person = parseArg(field.id("Person"), userId);
    await requireEventAdmin(id);

    // Only someone actually on this event's staff.
    const supabase = await createClient();
    const found = await Promise.all(
      STAFF_ROLES.map((r) =>
        supabase
          .from(TABLE[r])
          .select("id")
          .eq("event_id", id)
          .eq(USER_COLUMN[r] as never, person)
          .eq("status", "active")
          .limit(1),
      ),
    );
    if (!found.some((res) => res.data?.length))
      throw new InviteError("That person isn't on this event's staff.");
    const email = await pendingEmail(person);
    if (!email) throw new InviteError("They have already signed in; there's nothing to resend.");
    return await resendMessage(person, email);
  } catch (error) {
    return failure(error);
  }
}

async function remove(role: EventStaffRole, eventId: string, assignmentId: string) {
  await requireEventAdmin(eventId);
  const supabase = await createClient();

  expectChanged(
    await supabase
      .from(TABLE[role])
      .update({ status: "removed", removed_at: new Date().toISOString() })
      .eq("id", assignmentId)
      .eq("event_id", eventId)
      .select("id"),
    `remove the ${role}`,
  );

  revalidatePath(`/admin/events/${eventId}/staff`);
}

export async function removeEventScorekeeper(eventId: string, assignmentId: string) {
  await remove("scorekeeper", eventId, assignmentId);
}

export async function removeEventProducer(eventId: string, assignmentId: string) {
  await remove("producer", eventId, assignmentId);
}

export async function removeEventCommentator(eventId: string, assignmentId: string) {
  await remove("commentator", eventId, assignmentId);
}
