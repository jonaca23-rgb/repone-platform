"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { expectChanged, NotAuthorizedError, requireEventAccess } from "@/lib/auth/guards";
import { getEventStaffCandidates } from "@/lib/auth/eventStaffCandidates";
import { hasAnyRole } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { field, parseForm } from "@/lib/validation/form";

// Admin-only: assign/remove event-scoped Scorekeeper/Producer/Commentator
// staff (0024_event_role_assignments.sql). RLS only lets an admin of the
// event's organization write these tables (event directors can't), so the
// guard requires both: access to the event, and the admin role. Checking
// here gives a clear error instead of a silent RLS-denied failure.
async function requireEventAdmin(eventId: string) {
  const access = await requireEventAccess(eventId);
  if (!hasAnyRole(access.ctx, ["admin"]))
    throw new NotAuthorizedError("Only an admin can manage event staff assignments.");
  return access;
}

const TABLE = {
  scorekeeper: "event_scorekeeper_assignments",
  producer: "event_producer_assignments",
  commentator: "event_commentator_assignments",
} as const;

type EventStaffRole = keyof typeof TABLE;

const StaffForm = z.object({
  userId: z.guid({ error: "Select a staff account first." }),
});

const CommentatorForm = StaffForm.extend({
  roleLabel: field.optionalText({ max: 50, label: "Role label" }),
});

async function assign(role: EventStaffRole, eventId: string, formData: FormData) {
  const { ctx, organizationId } = await requireEventAdmin(eventId);
  const { userId, roleLabel } =
    role === "commentator"
      ? parseForm(CommentatorForm, formData)
      : { ...parseForm(StaffForm, formData), roleLabel: null };

  // Only someone the Staff page offers: a staff profile or an athlete account
  // in this event's organization.
  const candidates = await getEventStaffCandidates(organizationId);
  if (!candidates.some((c) => c.userId === userId))
    throw new NotAuthorizedError("That account can't be assigned to this event.");

  const supabase = await createClient();

  const common = {
    event_id: eventId,
    assigned_by_admin_id: ctx.userId,
    status: "active" as const,
    assigned_at: new Date().toISOString(),
    removed_at: null,
  };

  // Re-assigning someone previously removed just flips status back to
  // active on their existing row (unique(event_id, <role>_user_id)) rather
  // than erroring on a duplicate or leaving two rows behind.
  const { error } =
    role === "scorekeeper"
      ? await supabase
          .from("event_scorekeeper_assignments")
          .upsert(
            { ...common, scorekeeper_user_id: userId },
            { onConflict: "event_id,scorekeeper_user_id" },
          )
      : role === "producer"
        ? await supabase
            .from("event_producer_assignments")
            .upsert(
              { ...common, producer_user_id: userId },
              { onConflict: "event_id,producer_user_id" },
            )
        : await supabase
            .from("event_commentator_assignments")
            .upsert(
              { ...common, commentator_user_id: userId, role_label: roleLabel },
              { onConflict: "event_id,commentator_user_id" },
            );
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/events/${eventId}/staff`);
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

export async function assignEventScorekeeper(eventId: string, formData: FormData) {
  await assign("scorekeeper", eventId, formData);
}

export async function removeEventScorekeeper(eventId: string, assignmentId: string) {
  await remove("scorekeeper", eventId, assignmentId);
}

export async function assignEventProducer(eventId: string, formData: FormData) {
  await assign("producer", eventId, formData);
}

export async function removeEventProducer(eventId: string, assignmentId: string) {
  await remove("producer", eventId, assignmentId);
}

export async function assignEventCommentator(eventId: string, formData: FormData) {
  await assign("commentator", eventId, formData);
}

export async function removeEventCommentator(eventId: string, assignmentId: string) {
  await remove("commentator", eventId, assignmentId);
}
