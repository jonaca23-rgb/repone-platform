import type { Metadata } from "next";
import { CalendarX2 } from "lucide-react";
import { getSessionContext } from "@/lib/auth/session";
import { getAssignedEvents } from "@/lib/auth/eventRoles";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { PickLink } from "@/components/app/PickLink";
import { OperatorShell } from "@/components/shells/OperatorShell";

export const metadata: Metadata = { title: "Producer" };

// Entry point into the event-scoped Producer tree
// (/producer/events/[eventId]/...). An admin sees every scheduled/live
// event in the org; anyone else sees only the events they hold an active
// producer assignment for (event_producer_assignments,
// 0024_event_role_assignments.sql) — assigned by an admin from that event's
// Staff tab in /admin. Per spec, admin should assign a producer to every
// event to guarantee it has a responsible production owner; nothing in the
// app enforces that yet (see architecture/rbac-audit-and-plan.md).
export default async function ProducerPickerPage() {
  const ctx = await getSessionContext();
  const events = await getAssignedEvents(ctx, "producer");

  return (
    <OperatorShell module="producer" moduleLabel="Producer">
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-10 sm:px-6">
        <PageHeader
          title="Select an event to produce"
          description="Only events you're assigned to produce show up here."
        />
        {events.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {events.map((e) => (
              <li key={e.id}>
                <PickLink
                  href={`/producer/events/${e.id}/dashboard`}
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
            description="Ask an admin to add you as a producer from that event's Staff tab."
          />
        )}
      </div>
    </OperatorShell>
  );
}
