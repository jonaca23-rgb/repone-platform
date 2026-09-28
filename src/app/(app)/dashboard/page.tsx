import Link from "next/link";
import { getSessionContext } from "@/lib/auth/session";
import { getAssignedEvents } from "@/lib/auth/eventRoles";
import { createClient } from "@/lib/db/server";

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
    ? await supabase.from("venues").select("id, name, event_id, floors(id, name)").in("event_id", eventIds)
    : { data: [] as Array<{ id: string; name: string; event_id: string; floors: { id: string; name: string }[] }> };

  const eventNameById = new Map(events.map((e) => [e.id, e.name]));

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <h1 className="mb-6 font-[family-name:var(--font-display)] text-3xl font-bold uppercase tracking-wide">
        Select a Floor
      </h1>
      <div className="flex flex-col gap-4">
        {(venues ?? []).flatMap((v) =>
          (v.floors ?? []).map((f) => (
            <Link
              key={f.id}
              href={`/dashboard/${f.id}`}
              className="control-btn control-btn-red flex-col !items-start gap-1 py-6"
            >
              <span className="text-2xl">{eventNameById.get(v.event_id) ?? "—"}</span>
              <span className="text-sm font-normal normal-case tracking-normal opacity-80">
                {v.name} — {f.name}
              </span>
            </Link>
          ))
        )}
        {events.length === 0 && (
          <p className="text-white/50">
            No events assigned to you yet — ask an admin to add you as a producer from that event&apos;s Staff tab.
          </p>
        )}
      </div>
    </div>
  );
}
