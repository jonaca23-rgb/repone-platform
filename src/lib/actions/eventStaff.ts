"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { getSessionContext } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/session";

// Admin-only: assign/remove event-scoped Scorekeeper/Producer/Commentator
// staff (0024_event_role_assignments.sql). RLS backs this up independently
// (only an admin can write these tables at all), but checking here too
// gives a clear error instead of a silent RLS-denied failure.
async function requireAdmin() {
  const ctx = await getSessionContext();
  if (!ctx || !hasAnyRole(ctx, ["admin"]))
    throw new Error("Only an admin can manage event staff assignments.");
  return ctx;
}

const TABLE = {
  scorekeeper: "event_scorekeeper_assignments",
  producer: "event_producer_assignments",
  commentator: "event_commentator_assignments",
} as const;

type EventStaffRole = keyof typeof TABLE;

async function assign(role: EventStaffRole, eventId: string, userId: string, roleLabel?: string) {
  const ctx = await requireAdmin();
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
              { ...common, commentator_user_id: userId, role_label: roleLabel || null },
              { onConflict: "event_id,commentator_user_id" },
            );
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/events/${eventId}/staff`);
}

async function remove(role: EventStaffRole, eventId: string, assignmentId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from(TABLE[role])
    .update({ status: "removed", removed_at: new Date().toISOString() })
    .eq("id", assignmentId);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/events/${eventId}/staff`);
}

export async function assignEventScorekeeper(eventId: string, formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  if (!userId) throw new Error("Select a staff account first.");
  await assign("scorekeeper", eventId, userId);
}

export async function removeEventScorekeeper(eventId: string, assignmentId: string) {
  await remove("scorekeeper", eventId, assignmentId);
}

export async function assignEventProducer(eventId: string, formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  if (!userId) throw new Error("Select a staff account first.");
  await assign("producer", eventId, userId);
}

export async function removeEventProducer(eventId: string, assignmentId: string) {
  await remove("producer", eventId, assignmentId);
}

export async function assignEventCommentator(eventId: string, formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  if (!userId) throw new Error("Select a staff account first.");
  const roleLabel = String(formData.get("roleLabel") ?? "");
  await assign("commentator", eventId, userId, roleLabel);
}

export async function removeEventCommentator(eventId: string, assignmentId: string) {
  await remove("commentator", eventId, assignmentId);
}
