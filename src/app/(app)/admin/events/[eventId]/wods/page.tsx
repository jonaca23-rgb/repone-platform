import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { createWod, deleteWod, updateWod } from "@/lib/actions/wods";

export default async function WodsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await createClient();
  const [{ data: event }, { data: wods }] = await Promise.all([
    supabase.from("events").select("name").eq("id", eventId).maybeSingle(),
    supabase
      .from("wods")
      .select("id, name, scoring_type, time_cap_seconds, tiebreak_type, description, rules")
      .eq("event_id", eventId)
      .order("sort_order"),
  ]);

  return (
    <div>
      <p className="mb-4 text-sm">
        <Link href={`/admin/events/${eventId}`} className="text-repone-red underline">
          ← {event?.name ?? "Back to Event"}
        </Link>
      </p>
      <h1 className="mb-6 text-2xl font-bold">WODs</h1>

      <form
        action={createWod.bind(null, eventId)}
        className="mb-8 grid grid-cols-2 gap-3 rounded-lg border border-black/10 p-4 sm:grid-cols-3"
      >
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input
            name="name"
            required
            placeholder="WOD 2"
            className="rounded-md border border-black/20 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Scoring type
          <select name="scoring_type" className="rounded-md border border-black/20 px-3 py-2">
            <option value="for_time">For Time</option>
            <option value="amrap">AMRAP</option>
            <option value="max_load">Max Load</option>
            <option value="points">Points</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Time cap (minutes)
          <input
            name="time_cap_minutes"
            type="number"
            min={0}
            className="rounded-md border border-black/20 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Tie-break
          <select name="tiebreak_type" className="rounded-md border border-black/20 px-3 py-2">
            <option value="none">None</option>
            <option value="time">Time</option>
            <option value="reps">Reps</option>
            <option value="load">Load</option>
            <option value="points">Points</option>
          </select>
        </label>
        <label className="col-span-2 flex flex-col gap-1 text-sm sm:col-span-3">
          Description / rules
          <textarea
            name="description"
            rows={2}
            className="rounded-md border border-black/20 px-3 py-2"
          />
        </label>
        <button className="control-btn control-btn-red col-span-2 w-fit px-6 py-3 text-base sm:col-span-3">
          Add WOD
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {(wods ?? []).map((w) => (
          <div key={w.id} className="rounded-lg border border-black/10 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{w.name}</p>
                <p className="text-xs uppercase tracking-wide text-black/50">
                  {w.scoring_type.replace("_", " ")}{" "}
                  {w.time_cap_seconds ? `· ${w.time_cap_seconds / 60} min cap` : ""}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <details className="relative">
                  <summary className="cursor-pointer text-sm font-semibold text-repone-red">
                    Edit
                  </summary>
                  <form
                    action={updateWod.bind(null, eventId, w.id)}
                    className="mt-3 grid grid-cols-2 gap-3 rounded-lg border border-black/10 bg-black/[0.02] p-4 sm:grid-cols-3"
                  >
                    <label className="flex flex-col gap-1 text-sm">
                      Name
                      <input
                        name="name"
                        required
                        defaultValue={w.name}
                        className="rounded-md border border-black/20 px-3 py-2"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      Scoring type
                      <select
                        name="scoring_type"
                        defaultValue={w.scoring_type}
                        className="rounded-md border border-black/20 px-3 py-2"
                      >
                        <option value="for_time">For Time</option>
                        <option value="amrap">AMRAP</option>
                        <option value="max_load">Max Load</option>
                        <option value="points">Points</option>
                        <option value="other">Other</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      Time cap (minutes)
                      <input
                        name="time_cap_minutes"
                        type="number"
                        min={0}
                        defaultValue={w.time_cap_seconds ? w.time_cap_seconds / 60 : ""}
                        className="rounded-md border border-black/20 px-3 py-2"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      Tie-break
                      <select
                        name="tiebreak_type"
                        defaultValue={w.tiebreak_type}
                        className="rounded-md border border-black/20 px-3 py-2"
                      >
                        <option value="none">None</option>
                        <option value="time">Time</option>
                        <option value="reps">Reps</option>
                        <option value="load">Load</option>
                        <option value="points">Points</option>
                      </select>
                    </label>
                    <label className="col-span-2 flex flex-col gap-1 text-sm sm:col-span-3">
                      Description / rules
                      <textarea
                        name="description"
                        rows={2}
                        defaultValue={w.description ?? ""}
                        className="rounded-md border border-black/20 px-3 py-2"
                      />
                    </label>
                    <input type="hidden" name="rules" defaultValue={w.rules ?? ""} />
                    <button className="control-btn control-btn-red col-span-2 w-fit px-6 py-3 text-base sm:col-span-3">
                      Save Changes
                    </button>
                  </form>
                </details>
                <form action={deleteWod.bind(null, eventId, w.id)}>
                  <button className="text-sm text-black/40 hover:text-repone-red">Remove</button>
                </form>
              </div>
            </div>
          </div>
        ))}
        {wods?.length === 0 && <p className="text-black/50">No WODs yet.</p>}
      </div>
    </div>
  );
}
