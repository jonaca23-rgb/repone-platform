import Link from "next/link";
import { getSessionContext } from "@/lib/auth/session";
import { getAssignedEvents } from "@/lib/auth/eventRoles";

// Entry point into the event-scoped Scorekeeper tree
// (/scorekeeper/events/[eventId]). An admin sees every scheduled/live event
// in the org, same as before; anyone else sees only the events they hold an
// active scorekeeper assignment for (event_scorekeeper_assignments,
// 0024_event_role_assignments.sql) — assigned by an admin from that event's
// Staff tab in /admin.
export default async function ScoreKeeperPickerPage() {
  const ctx = await getSessionContext();
  const events = await getAssignedEvents(ctx, "scorekeeper");

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <h1 className="mb-1 font-[family-name:var(--font-display)] text-3xl font-bold uppercase tracking-wide">
        Select an Event to Score
      </h1>
      <p className="mb-6 text-sm text-white/50">
        Only events you&apos;re assigned to score show up here.
      </p>
      <div className="flex flex-col gap-4">
        {events.map((e) => (
          <Link
            key={e.id}
            href={`/scorekeeper/events/${e.id}`}
            className="control-btn control-btn-red flex-col !items-start gap-1 py-6"
          >
            <span className="text-2xl">{e.name}</span>
            <span className="text-sm font-normal normal-case tracking-normal opacity-80">
              {e.status === "live" ? "Live now" : "Scheduled"}
            </span>
          </Link>
        ))}
        {events.length === 0 && (
          <p className="text-white/50">
            No events assigned to you yet — ask an admin to add you as a scorekeeper from that
            event&apos;s Staff tab.
          </p>
        )}
      </div>
    </div>
  );
}
