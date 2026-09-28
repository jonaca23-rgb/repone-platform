import { notFound } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { getEventStaffCandidates, getDisplayNamesByUserId, type StaffCandidate } from "@/lib/auth/eventStaffCandidates";
import {
  assignEventScorekeeper,
  removeEventScorekeeper,
  assignEventProducer,
  removeEventProducer,
  assignEventCommentator,
  removeEventCommentator,
} from "@/lib/actions/eventStaff";

interface AssignmentRow {
  id: string;
  user_id: string;
  role_label?: string | null;
}

/**
 * Assign Scorekeeper/Producer/Commentator staff to this event
 * (event_scorekeeper_assignments / event_producer_assignments /
 * event_commentator_assignments, 0024_event_role_assignments.sql).
 *
 * Per Jonathan: the candidate pool isn't limited to existing staff profiles
 * (today that's only ever the admin — there's still no separate staff
 * invite flow, see architecture/rbac-audit-and-plan.md, §1/§8) — it also
 * includes any athlete who already has a real Supabase Auth account
 * (signed up through the Athlete Portal). Nothing about these assignment
 * tables cares whether the assigned account is "staff" or "athlete";
 * see lib/auth/eventStaffCandidates.ts for why that widening is safe.
 */
export default async function EventStaffPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("id, name").eq("id", eventId).single();
  if (!event) notFound();

  const [candidates, { data: scorekeepers }, { data: producers }, { data: commentators }] = await Promise.all([
    getEventStaffCandidates(ctx?.organizationId ?? null),
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

  const scorekeeperRows: AssignmentRow[] = (scorekeepers ?? []).map((s) => ({ id: s.id, user_id: s.scorekeeper_user_id }));
  const producerRows: AssignmentRow[] = (producers ?? []).map((p) => ({ id: p.id, user_id: p.producer_user_id }));
  const commentatorRows: AssignmentRow[] = (commentators ?? []).map((c) => ({
    id: c.id,
    user_id: c.commentator_user_id,
    role_label: c.role_label,
  }));

  // Candidates already carry a good label ("Name (Staff)"/"Name (Athlete)")
  // for the dropdown, but assignment rows only store a user_id — resolve
  // those the same way so an already-assigned athlete shows their real name
  // instead of "Unknown".
  const assignedUserIds = [...scorekeeperRows, ...producerRows, ...commentatorRows].map((r) => r.user_id);
  const resolvedNames = await getDisplayNamesByUserId(assignedUserIds);
  const candidateLabelById = new Map(candidates.map((c) => [c.userId, c.label]));
  const nameById = new Map(
    assignedUserIds.map((id) => [id, candidateLabelById.get(id) ?? resolvedNames.get(id) ?? "Unknown account"])
  );

  return (
    <div className="flex flex-col gap-8">
      <p className="text-sm text-black/50">
        Assign existing staff or athlete accounts to <strong>{event.name}</strong>. Each role only gets access to
        this event — not every event in the org.
      </p>

      <StaffRoleSection
        title="Scorekeepers"
        description="Can enter/save scores, view heats, lanes, and standings for this event."
        rows={scorekeeperRows}
        nameById={nameById}
        candidates={candidates}
        assignAction={assignEventScorekeeper.bind(null, eventId)}
        removeAction={removeEventScorekeeper.bind(null, eventId)}
      />

      <StaffRoleSection
        title="Producers"
        description="Full production access for this event only — heats, lanes, scores, broadcast control, sponsor triggers."
        rows={producerRows}
        nameById={nameById}
        candidates={candidates}
        assignAction={assignEventProducer.bind(null, eventId)}
        removeAction={removeEventProducer.bind(null, eventId)}
      />

      <StaffRoleSection
        title="Commentators"
        description="Read-only access to the Commentator Dashboard for this event."
        rows={commentatorRows}
        nameById={nameById}
        candidates={candidates}
        assignAction={assignEventCommentator.bind(null, eventId)}
        removeAction={removeEventCommentator.bind(null, eventId)}
        showRoleLabel
      />
    </div>
  );
}

function StaffRoleSection({
  title,
  description,
  rows,
  nameById,
  candidates,
  assignAction,
  removeAction,
  showRoleLabel = false,
}: {
  title: string;
  description: string;
  rows: AssignmentRow[];
  nameById: Map<string, string>;
  candidates: StaffCandidate[];
  assignAction: (formData: FormData) => Promise<void>;
  removeAction: (assignmentId: string) => Promise<void>;
  showRoleLabel?: boolean;
}) {
  const assignedIds = new Set(rows.map((r) => r.user_id));
  const available = candidates.filter((c) => !assignedIds.has(c.userId));

  return (
    <section className="rounded-xl border border-black/10 p-5">
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mb-4 text-sm text-black/50">{description}</p>

      <div className="mb-4 flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg bg-black/5 px-4 py-2">
            <span className="font-semibold">
              {nameById.get(r.user_id) ?? "Unknown"}
              {showRoleLabel && r.role_label ? (
                <span className="ml-2 text-xs font-normal uppercase tracking-wide text-black/40">
                  {r.role_label.replace(/_/g, " ")}
                </span>
              ) : null}
            </span>
            <form action={removeAction.bind(null, r.id)}>
              <button type="submit" className="text-sm text-repone-red hover:underline">
                Remove
              </button>
            </form>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-black/40">Nobody assigned yet.</p>}
      </div>

      {available.length === 0 ? (
        <p className="text-sm text-black/40">No other staff or athlete accounts available to assign.</p>
      ) : (
        <form action={assignAction} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Account
            <select name="userId" required className="rounded-md border border-black/20 px-3 py-2">
              {available.map((c) => (
                <option key={c.userId} value={c.userId}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          {showRoleLabel && (
            <label className="flex flex-col gap-1 text-sm">
              Role label (optional)
              <select name="roleLabel" className="rounded-md border border-black/20 px-3 py-2">
                <option value="">—</option>
                <option value="main_commentator">Main Commentator</option>
                <option value="co_commentator">Co-Commentator</option>
                <option value="sideline_reporter">Sideline Reporter</option>
                <option value="interviewer">Interviewer</option>
              </select>
            </label>
          )}
          <button type="submit" className="rounded-md bg-repone-red px-4 py-2 font-semibold text-white">
            Assign
          </button>
        </form>
      )}
    </section>
  );
}
