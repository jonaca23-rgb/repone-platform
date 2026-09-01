import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { createHeat, deleteHeat } from "@/lib/actions/heats";

export default async function HeatsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await createClient();

  const [{ data: floors }, { data: wods }, { data: divisions }, { data: heats }] = await Promise.all([
    supabase.from("floors").select("id, name, venues!inner(event_id)").eq("venues.event_id", eventId),
    supabase.from("wods").select("id, name").eq("event_id", eventId).order("sort_order"),
    supabase.from("divisions").select("id, name").eq("event_id", eventId).order("sort_order"),
    supabase
      .from("heats")
      .select("id, heat_number, heat_count, scheduled_start, wods(name), divisions(name), floors(name), lanes(id)")
      .eq("event_id", eventId)
      .order("heat_number"),
  ]);

  // See lib/db/queries.ts header comment: cast many-to-one embeds back to single objects.
  const typedHeats = (heats ?? []) as unknown as Array<{
    id: string;
    heat_number: number;
    heat_count: number | null;
    wods: { name: string } | null;
    divisions: { name: string } | null;
    floors: { name: string } | null;
    lanes: Array<{ id: string }> | null;
  }>;

  const canCreate = (floors?.length ?? 0) > 0 && (wods?.length ?? 0) > 0 && (divisions?.length ?? 0) > 0;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Heats & Lanes</h1>

      {!canCreate ? (
        <p className="mb-6 text-sm text-black/50">
          Set up at least one floor, one WOD, and one division before creating heats.
        </p>
      ) : (
        <form
          action={createHeat.bind(null, eventId)}
          className="mb-8 grid grid-cols-2 gap-3 rounded-lg border border-black/10 p-4 sm:grid-cols-4"
        >
          <label className="flex flex-col gap-1 text-sm">
            Floor
            <select name="floor_id" required className="rounded-md border border-black/20 px-3 py-2">
              {(floors ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            WOD
            <select name="wod_id" required className="rounded-md border border-black/20 px-3 py-2">
              {(wods ?? []).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Division
            <select name="division_id" required className="rounded-md border border-black/20 px-3 py-2">
              {(divisions ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Heat #
            <input name="heat_number" type="number" min={1} required className="rounded-md border border-black/20 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Of (total heats)
            <input name="heat_count" type="number" min={1} className="rounded-md border border-black/20 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Lanes
            <input name="lane_count" type="number" min={1} max={20} defaultValue={6} className="rounded-md border border-black/20 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Scheduled start
            <input name="scheduled_start" type="datetime-local" className="rounded-md border border-black/20 px-3 py-2" />
          </label>
          <button className="control-btn control-btn-red self-end px-6 py-3 text-base">Add Heat</button>
        </form>
      )}

      <div className="flex flex-col gap-2">
        {typedHeats.map((h) => (
          <div key={h.id} className="flex items-center justify-between rounded-lg border border-black/10 px-4 py-3">
            <Link href={`/admin/events/${eventId}/heats/${h.id}`} className="flex-1">
              <p className="font-semibold">
                {h.wods?.name} — Heat {h.heat_number}
                {h.heat_count ? ` / ${h.heat_count}` : ""}
              </p>
              <p className="text-xs uppercase tracking-wide text-black/50">
                {h.divisions?.name} · {h.floors?.name} · {h.lanes?.length ?? 0} lanes
              </p>
            </Link>
            <form action={deleteHeat.bind(null, eventId, h.id)}>
              <button className="text-sm text-black/40 hover:text-repone-red">Remove</button>
            </form>
          </div>
        ))}
        {heats?.length === 0 && <p className="text-black/50">No heats yet.</p>}
      </div>
    </div>
  );
}
