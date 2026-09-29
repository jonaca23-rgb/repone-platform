import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { getDisplayNamesByUserId } from "@/lib/auth/eventStaffCandidates";

// Read view of who's assigned to commentate this event — "View commentator
// dashboard" + visibility into commentator access per spec. Assigning/
// removing commentators stays admin-only (that event's Staff tab in
// /admin), per "Commentator access management for that event if admin
// allows it" — not exposed here yet.
//
// Name resolution goes through getDisplayNamesByUserId rather than a local
// profiles-only lookup: since the Staff page can assign an athlete account
// as a commentator (see lib/auth/eventStaffCandidates.ts), a profiles-only
// query here would show "Unnamed staff account" for any commentator who is
// actually an athlete.
export default async function ProducerEventCommentaryPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = await createClient();

  const { data: assignments } = await supabase
    .from("event_commentator_assignments")
    .select("id, commentator_user_id, role_label")
    .eq("event_id", eventId)
    .eq("status", "active");

  const userIds = (assignments ?? []).map((a) => a.commentator_user_id);
  const nameById = await getDisplayNamesByUserId(userIds);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <Link
        href={`/commentator/events/${eventId}/dashboard`}
        className="control-btn control-btn-red mb-4 inline-flex w-fit"
      >
        View Commentator Dashboard →
      </Link>
      <div className="flex flex-col gap-1.5">
        {(assignments ?? []).map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between rounded-lg bg-repone-gray px-4 py-2.5"
          >
            <span className="font-semibold text-white">
              {nameById.get(a.commentator_user_id) ?? "Unknown account"}
            </span>
            {a.role_label && (
              <span className="rounded-full bg-black/40 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-repone-red">
                {a.role_label.replace(/_/g, " ")}
              </span>
            )}
          </div>
        ))}
        {(assignments ?? []).length === 0 && (
          <p className="text-white/50">No commentators assigned to this event yet.</p>
        )}
      </div>
    </div>
  );
}
