import type { Metadata } from "next";
import { CalendarX2 } from "lucide-react";
import { getSessionContext } from "@/lib/auth/session";
import { getAssignedEvents } from "@/lib/auth/eventRoles";
import { createClient } from "@/lib/db/server";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { PickLink } from "@/components/app/PickLink";

export const metadata: Metadata = { title: "Production dashboard" };

// Old floor-direct picker for the Production Dashboard — kept working, but
// now scoped to events the signed-in user is actually assigned to produce
// (event_producer_assignments, 0024_event_role_assignments.sql), same as
// /scorekeeper and /commentator. The new event-scoped tree
// (/producer/events/[eventId]/...) is the primary entry point going
// forward; this route stays as a direct link into the same underlying
// floor screen (/dashboard/[floorId], unchanged).
export default async function DashboardPickerPage() {
  const ctx = await getSessionContext();
  const events = await getAssignedEvents(ctx, "producer");
  const eventIds = events.map((e) => e.id);

  const supabase = await createClient();
  const { data: venues } = eventIds.length
    ? await supabase
        .from("venues")
        .select("id, name, event_id, floors(id, name)")
        .in("event_id", eventIds)
    : {
        data: [] as Array<{
          id: string;
          name: string;
          event_id: string;
          floors: { id: string; name: string }[];
        }>,
      };

  const eventNameById = new Map(events.map((e) => [e.id, e.name]));
  const floors = (venues ?? []).flatMap((v) =>
    (v.floors ?? []).map((f) => ({ venue: v, floor: f })),
  );

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-10 sm:px-6">
      <PageHeader title="Select a floor" />
      {floors.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {floors.map(({ venue, floor }) => (
            <li key={floor.id}>
              <PickLink
                href={`/dashboard/${floor.id}`}
                title={eventNameById.get(venue.event_id) ?? "—"}
                detail={`${venue.name} — ${floor.name}`}
              />
            </li>
          ))}
        </ul>
      ) : events.length === 0 ? (
        <EmptyState
          icon={CalendarX2}
          title="No events assigned to you yet"
          description="Ask an admin to add you as a producer from that event's Staff tab."
        />
      ) : (
        <EmptyState
          icon={CalendarX2}
          title="No floors set up yet"
          description="Your events have no venues with floors. Add them in Admin → Venues."
        />
      )}
    </div>
  );
}
