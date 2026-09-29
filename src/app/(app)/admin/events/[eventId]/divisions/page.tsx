import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { createDivision, deleteDivision } from "@/lib/actions/divisions";

export default async function DivisionsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await createClient();
  const [{ data: event }, { data: divisions }] = await Promise.all([
    supabase.from("events").select("name").eq("id", eventId).maybeSingle(),
    supabase.from("divisions").select("id, name").eq("event_id", eventId).order("sort_order"),
  ]);

  return (
    <div>
      <p className="mb-4 text-sm">
        <Link href={`/admin/events/${eventId}`} className="text-repone-red underline">
          ← {event?.name ?? "Back to Event"}
        </Link>
      </p>
      <h1 className="mb-6 text-2xl font-bold">Divisions</h1>

      <form action={createDivision.bind(null, eventId)} className="mb-8 flex items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Division name
          <input
            name="name"
            required
            placeholder="Intermediate Female"
            className="rounded-md border border-black/20 px-3 py-2"
          />
        </label>
        <button className="control-btn control-btn-red px-6 py-3 text-base">Add Division</button>
      </form>

      <div className="flex flex-col gap-2">
        {(divisions ?? []).map((d) => (
          <div
            key={d.id}
            className="flex items-center justify-between rounded-lg border border-black/10 px-4 py-3"
          >
            <span className="font-semibold">{d.name}</span>
            <form action={deleteDivision.bind(null, eventId, d.id)}>
              <button className="text-sm text-black/40 hover:text-repone-red">Remove</button>
            </form>
          </div>
        ))}
        {divisions?.length === 0 && <p className="text-black/50">No divisions yet.</p>}
      </div>
    </div>
  );
}
