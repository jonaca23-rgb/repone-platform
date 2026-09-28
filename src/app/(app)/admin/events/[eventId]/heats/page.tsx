import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/db/server";
import { createHeat, deleteHeat, generateHeats } from "@/lib/actions/heats";
import { compareDivisionNames, compareHeatsForRunningOrder } from "@/lib/scoring/divisionOrder";

export default async function HeatsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await createClient();
  const cookieStore = await cookies();
  const lastLanesPerHeat = Number(cookieStore.get(`repone_lanes_per_heat_${eventId}`)?.value ?? 6) || 6;

  const [{ data: event }, { data: floors }, { data: wods }, { data: divisions }, { data: heats }, { data: registrations }] =
    await Promise.all([
      supabase.from("events").select("name").eq("id", eventId).maybeSingle(),
      supabase.from("floors").select("id, name, venues!inner(event_id)").eq("venues.event_id", eventId),
      // wods.sort_order has the same problem as divisions.sort_order — every
      // row defaults to 0 and nothing sets it, so it's a no-op. created_at is
      // "the order this WOD was entered," which is what Jonathan wants WODs
      // to run in (a WOD's name, unlike a division's, carries no ordering
      // information — see lib/scoring/divisionOrder.ts's file header).
      supabase.from("wods").select("id, name, created_at").eq("event_id", eventId).order("created_at"),
      // divisions.sort_order defaults to 0 for every row (nothing sets it to
      // anything else), so the dropdowns below are re-sorted in JS by name
      // instead — see the compareDivisionNames sort just below this query.
      supabase.from("divisions").select("id, name").eq("event_id", eventId),
      supabase
        .from("heats")
        .select(
          "id, heat_number, heat_count, scheduled_start, ended_at, wods(name, created_at), divisions(name), floors(name), lanes(id)"
        )
        .eq("event_id", eventId),
      supabase.from("registrations").select("division_id").eq("event_id", eventId),
    ]);

  // Divisions run back-to-back in Jonathan's fixed running order (Scale
  // before Rx, Male before Female — see lib/scoring/divisionOrder.ts), used
  // both for the Floor/WOD/Division dropdowns below and for the heat list.
  const orderedDivisions = (divisions ?? []).slice().sort((a, b) => compareDivisionNames(a.name, b.name));

  // See lib/db/queries.ts header comment: cast many-to-one embeds back to single objects.
  const typedHeats = ((heats ?? []) as unknown as Array<{
    id: string;
    heat_number: number;
    heat_count: number | null;
    ended_at: string | null;
    wods: { name: string; created_at: string } | null;
    divisions: { name: string } | null;
    floors: { name: string } | null;
    lanes: Array<{ id: string }> | null;
  }>)
    .slice()
    .sort((a, b) =>
      compareHeatsForRunningOrder(
        { wodCreatedAt: a.wods?.created_at ?? "", divisionName: a.divisions?.name ?? "", heatNumber: a.heat_number },
        { wodCreatedAt: b.wods?.created_at ?? "", divisionName: b.divisions?.name ?? "", heatNumber: b.heat_number }
      )
    );

  const registrationCounts = new Map<string, number>();
  (registrations ?? []).forEach((r) => {
    registrationCounts.set(r.division_id, (registrationCounts.get(r.division_id) ?? 0) + 1);
  });

  // The first heat (in schedule order) that hasn't been finished yet — the
  // list highlights this one as "Next Up" so the operator always knows where
  // to go after wrapping up the current heat.
  const nextUpcomingId = typedHeats.find((h) => !h.ended_at)?.id ?? null;

  const canCreate = (floors?.length ?? 0) > 0 && (wods?.length ?? 0) > 0 && (divisions?.length ?? 0) > 0;

  return (
    <div>
      <p className="mb-4 text-sm">
        <Link href={`/admin/events/${eventId}`} className="text-repone-red underline">
          ← {event?.name ?? "Back to Event"}
        </Link>
      </p>
      <h1 className="mb-6 text-2xl font-bold">Heats & Lanes</h1>

      {!canCreate ? (
        <p className="mb-6 text-sm text-black/50">
          Set up at least one floor, one WOD, and one division before creating heats.
        </p>
      ) : (
        <>
          <div className="mb-4 rounded-lg border border-black/10 p-4">
            <h2 className="mb-1 font-semibold uppercase tracking-wide text-black/60">Generate Heats</h2>
            <p className="mb-3 text-sm text-black/50">
              Pick a Floor, WOD, and Division and how many lanes to run at once — every athlete or team already
              registered for that division gets slotted into lanes automatically, across as many heats as it takes.
            </p>
            <form
              action={generateHeats.bind(null, eventId)}
              className="grid grid-cols-2 gap-3 sm:grid-cols-4"
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
                  {orderedDivisions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({registrationCounts.get(d.id) ?? 0} registered)
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Lanes per heat
                <input
                  name="lanes_per_heat"
                  type="number"
                  min={1}
                  max={20}
                  defaultValue={lastLanesPerHeat}
                  required
                  className="rounded-md border border-black/20 px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                First heat start
                <input name="scheduled_start" type="datetime-local" className="rounded-md border border-black/20 px-3 py-2" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Minutes between heats
                <input
                  name="interval_minutes"
                  type="number"
                  min={0}
                  defaultValue={10}
                  className="rounded-md border border-black/20 px-3 py-2"
                />
              </label>
              <button className="control-btn control-btn-red self-end px-6 py-3 text-base">Generate Heats</button>
            </form>
          </div>

          <details className="mb-8 rounded-lg border border-black/10 p-4">
            <summary className="cursor-pointer font-semibold uppercase tracking-wide text-black/60">
              Add Single Heat (manual)
            </summary>
            <form
              action={createHeat.bind(null, eventId)}
              className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4"
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
                  {orderedDivisions.map((d) => (
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
          </details>
        </>
      )}

      <div className="flex flex-col gap-2">
        {typedHeats.map((h) => {
          const completed = Boolean(h.ended_at);
          const isNextUp = h.id === nextUpcomingId;
          return (
            <div
              key={h.id}
              className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                isNextUp
                  ? "border-repone-red bg-red-50 ring-1 ring-repone-red"
                  : completed
                    ? "border-black/10 bg-black/[0.02]"
                    : "border-black/10"
              }`}
            >
              <Link href={`/admin/events/${eventId}/heats/${h.id}`} className="flex-1">
                <p className="flex items-center gap-2 font-semibold">
                  {h.wods?.name} — Heat {h.heat_number}
                  {h.heat_count ? ` / ${h.heat_count}` : ""}
                  {completed && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-800">
                      ✓ Completed
                    </span>
                  )}
                  {isNextUp && (
                    <span className="rounded-full bg-repone-red px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      Next Up
                    </span>
                  )}
                </p>
                <p className="text-xs uppercase tracking-wide text-black/50">
                  {h.divisions?.name} · {h.floors?.name} · {h.lanes?.length ?? 0} lanes
                </p>
              </Link>
              <form action={deleteHeat.bind(null, eventId, h.id)}>
                <button className="text-sm text-black/40 hover:text-repone-red">Remove</button>
              </form>
            </div>
          );
        })}
        {heats?.length === 0 && <p className="text-black/50">No heats yet.</p>}
      </div>
    </div>
  );
}
