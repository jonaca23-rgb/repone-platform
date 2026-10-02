import type { Metadata } from "next";
import { CalendarX2 } from "lucide-react";
import { getSessionContext } from "@/lib/auth/session";
import { getAssignedEvents } from "@/lib/auth/eventRoles";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { PickLink } from "@/components/app/PickLink";
import { OperatorShell } from "@/components/shells/OperatorShell";

export const metadata: Metadata = { title: "Scorekeeper" };

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
    <OperatorShell module="scorekeeper" moduleLabel="Scorekeeper">
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-10 sm:px-6">
        <PageHeader
          title="Select an event to score"
          description="Only events you're assigned to score show up here."
        />
        {events.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {events.map((e) => (
              <li key={e.id}>
                <PickLink
                  href={`/scorekeeper/events/${e.id}`}
                  title={e.name}
                  detail={e.status === "live" ? "Live now" : "Scheduled"}
                />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={CalendarX2}
            title="No events assigned to you yet"
            description="Ask an admin to add you as a scorekeeper from that event's Staff tab."
          />
        )}
      </div>
    </OperatorShell>
  );
}
