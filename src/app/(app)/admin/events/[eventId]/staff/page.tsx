import { notFound, redirect } from "next/navigation";
import { getSessionContext, orgCan } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { getDisplayNamesByUserId } from "@/lib/db/people";
import { emailsByUserId, isPending } from "@/lib/auth/invite";
import { InlineActionButton, InviteByEmailForm } from "@/components/InviteForms";
import {
  inviteEventStaff,
  resendEventInvite,
  removeEventScorekeeper,
  removeEventProducer,
  removeEventCommentator,
} from "@/lib/actions/eventStaff";

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
export default async function EventStaffPage({ params }: { params: Promise<{ eventId: string }> }) {
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

  const sections = [
    {
      role: "scorekeeper",
      title: "Scorekeepers",
      description: "Can enter/save scores, view heats, lanes, and standings for this event.",
      rows: scorekeeperRows,
      removeAction: removeEventScorekeeper.bind(null, eventId),
    },
    {
      role: "producer",
      title: "Producers",
      description:
        "Full production access for this event only — heats, lanes, scores, broadcast control, sponsor triggers.",
      rows: producerRows,
      removeAction: removeEventProducer.bind(null, eventId),
    },
    {
      role: "commentator",
      title: "Commentators",
      description: "Read-only access to the Commentator Dashboard for this event.",
      rows: commentatorRows,
      removeAction: removeEventCommentator.bind(null, eventId),
      showRoleLabel: true,
    },
  ] as const;

  return (
    <div className="flex flex-col gap-8">
      <p className="text-sm text-black/50">
        Invite people by email to <strong>{event.name}</strong>. Each role only gets access to this
        event.
      </p>

      {sections.map((s) => (
        <StaffRoleSection
          key={s.role}
          title={s.title}
          description={s.description}
          rows={s.rows}
          nameById={nameById}
          pending={pending}
          inviteAction={inviteEventStaff.bind(null, s.role, eventId)}
          resendAction={(userId) => resendEventInvite.bind(null, eventId, userId)}
          removeAction={s.removeAction}
          showRoleLabel={"showRoleLabel" in s && s.showRoleLabel}
        />
      ))}
    </div>
  );
}

function StaffRoleSection({
  title,
  description,
  rows,
  nameById,
  pending,
  inviteAction,
  resendAction,
  removeAction,
  showRoleLabel = false,
}: {
  title: string;
  description: string;
  rows: AssignmentRow[];
  nameById: Map<string, string>;
  pending: Set<string>;
  inviteAction: Parameters<typeof InviteByEmailForm>[0]["action"];
  resendAction: (userId: string) => Parameters<typeof InlineActionButton>[0]["action"];
  removeAction: (assignmentId: string) => Promise<void>;
  showRoleLabel?: boolean;
}) {
  return (
    <section className="rounded-xl border border-black/10 p-5">
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mb-4 text-sm text-black/50">{description}</p>

      <div className="mb-4 flex flex-col gap-2">
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-black/5 px-4 py-2"
          >
            <span className="font-semibold">
              {nameById.get(r.user_id) ?? "Unknown"}
              {showRoleLabel && r.role_label ? (
                <span className="ml-2 text-xs font-normal uppercase tracking-wide text-black/40">
                  {r.role_label.replace(/_/g, " ")}
                </span>
              ) : null}
            </span>
            <span className="flex items-center gap-4">
              {pending.has(r.user_id) && (
                <span className="flex items-center gap-2 text-sm text-black/50">
                  Pending ·
                  <InlineActionButton action={resendAction(r.user_id)} label="Resend" />
                </span>
              )}
              <form action={removeAction.bind(null, r.id)}>
                <button type="submit" className="text-sm text-repone-red hover:underline">
                  Remove
                </button>
              </form>
            </span>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-black/40">Nobody assigned yet.</p>}
      </div>

      <InviteByEmailForm action={inviteAction} showRoleLabel={showRoleLabel} />
    </section>
  );
}
