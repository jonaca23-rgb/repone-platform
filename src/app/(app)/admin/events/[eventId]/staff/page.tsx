import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSessionContext, orgCan } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { getDisplayNamesByUserId } from "@/lib/db/people";
import { emailsByUserId, isPending } from "@/lib/auth/invite";
import { PageHeader } from "@/components/app/PageHeader";
import { AdminBreadcrumb, eventCrumbs } from "@/components/shells/AdminBreadcrumb";
import { getAdminEvent } from "../adminEvent";
import { type StaffRow, StaffTable } from "./StaffTable";

type Props = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await getAdminEvent((await params).eventId);
  return { title: event ? `Staff · ${event.name}` : "Staff" };
}

interface AssignmentRow {
  id: string;
  user_id: string;
  role_label?: string | null;
}

/**
 * Invite Scorekeeper/Producer/Commentator staff to this event by email
 * (event_scorekeeper_assignments / event_producer_assignments /
 * event_commentator_assignments, 0024_event_role_assignments.sql).
 *
 * An email with no account becomes a verified account with an invitation to
 * set a password; an existing account (staff or athlete) is just given access
 * and told so. See lib/auth/invite.ts. Rows whose person has never signed in
 * show as pending, with Resend.
 */
export default async function EventStaffPage({ params }: Props) {
  const { eventId } = await params;
  const ctx = await getSessionContext();
  // The page reads staff emails over the owner connection (invite.ts), so it
  // is for people who may invite staff to this organization's events.
  if (!orgCan(ctx, { staff: ["invite"] })) redirect("/admin");
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, name, organization_id")
    .eq("id", eventId)
    .single();
  if (!event || event.organization_id !== ctx!.organizationId) notFound();

  const [{ data: scorekeepers }, { data: producers }, { data: commentators }] = await Promise.all([
    supabase
      .from("event_scorekeeper_assignments")
      .select("id, scorekeeper_user_id")
      .eq("event_id", eventId)
      .eq("status", "active"),
    supabase
      .from("event_producer_assignments")
      .select("id, producer_user_id")
      .eq("event_id", eventId)
      .eq("status", "active"),
    supabase
      .from("event_commentator_assignments")
      .select("id, commentator_user_id, role_label")
      .eq("event_id", eventId)
      .eq("status", "active"),
  ]);

  const scorekeeperRows: AssignmentRow[] = (scorekeepers ?? []).map((s) => ({
    id: s.id,
    user_id: s.scorekeeper_user_id,
  }));
  const producerRows: AssignmentRow[] = (producers ?? []).map((p) => ({
    id: p.id,
    user_id: p.producer_user_id,
  }));
  const commentatorRows: AssignmentRow[] = (commentators ?? []).map((c) => ({
    id: c.id,
    user_id: c.commentator_user_id,
    role_label: c.role_label,
  }));

  // Someone invited by email has no name yet; their email stands in.
  const assignedUserIds = [
    ...new Set([...scorekeeperRows, ...producerRows, ...commentatorRows].map((r) => r.user_id)),
  ];
  const [names, emails, pending] = await Promise.all([
    getDisplayNamesByUserId(assignedUserIds),
    emailsByUserId(assignedUserIds),
    isPending(assignedUserIds),
  ]);
  const nameById = new Map(
    assignedUserIds.map((id) => [id, names.get(id) ?? emails.get(id) ?? "Unknown account"]),
  );

  const rows: StaffRow[] = [
    ...scorekeeperRows.map((r) => ({ ...r, role: "scorekeeper" as const })),
    ...producerRows.map((r) => ({ ...r, role: "producer" as const })),
    ...commentatorRows.map((r) => ({ ...r, role: "commentator" as const })),
  ].map((r) => ({
    id: r.id,
    userId: r.user_id,
    role: r.role,
    name: nameById.get(r.user_id) ?? "Unknown account",
    email: emails.get(r.user_id) ?? null,
    roleLabel: r.role_label ?? null,
    pending: pending.has(r.user_id),
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Staff"
        description={`Who works ${event.name}, and in which role. Each role only gets access to this event.`}
        breadcrumb={<AdminBreadcrumb items={eventCrumbs(event, { label: "Staff" })} />}
      />
      <StaffTable eventId={eventId} eventName={event.name} rows={rows} />
    </div>
  );
}
