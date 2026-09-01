import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { assignLane } from "@/lib/actions/lanes";
import { enterResult } from "@/lib/actions/results";

export default async function HeatDetailPage({
  params,
}: {
  params: Promise<{ eventId: string; heatId: string }>;
}) {
  const { eventId, heatId } = await params;
  const supabase = await createClient();

  const { data: heatRaw } = await supabase
    .from("heats")
    .select(
      "id, heat_number, heat_count, division_id, wod_id, floor_id, wods(name, scoring_type, time_cap_seconds), divisions(name), floors(name)"
    )
    .eq("id", heatId)
    .single();
  // See lib/db/queries.ts header comment: cast many-to-one embeds back to single objects.
  const heat = heatRaw as unknown as {
    id: string;
    heat_number: number;
    heat_count: number | null;
    division_id: string;
    wod_id: string;
    floor_id: string;
    wods: { name: string; scoring_type: "for_time" | "amrap" | "max_load" | "points" | "other"; time_cap_seconds: number | null } | null;
    divisions: { name: string } | null;
    floors: { name: string } | null;
  } | null;
  if (!heat) notFound();

  const [{ data: lanesRaw }, { data: registrationsRaw }, { data: results }, { data: standingsRaw }] = await Promise.all([
    supabase
      .from("lanes")
      .select("id, lane_number, athlete_id, athletes(first_name, last_name, affiliate)")
      .eq("heat_id", heatId)
      .order("lane_number"),
    supabase
      .from("registrations")
      .select("athlete_id, athletes(id, first_name, last_name)")
      .eq("division_id", heat.division_id),
    supabase.from("results").select("*").eq("heat_id", heatId),
    supabase
      .from("standings")
      .select("placement, points, athlete_id, athletes(first_name, last_name)")
      .eq("division_id", heat.division_id)
      .eq("wod_id", heat.wod_id)
      .order("placement"),
  ]);

  const lanes = lanesRaw as unknown as Array<{
    id: string;
    lane_number: number;
    athlete_id: string | null;
    athletes: { first_name: string; last_name: string; affiliate: string | null } | null;
  }> | null;
  const registrations = registrationsRaw as unknown as Array<{
    athlete_id: string | null;
    athletes: { id: string; first_name: string; last_name: string } | null;
  }> | null;
  const standings = standingsRaw as unknown as Array<{
    placement: number | null;
    points: number | null;
    athlete_id: string | null;
    athletes: { first_name: string; last_name: string } | null;
  }> | null;

  const resultByAthlete = new Map((results ?? []).map((r) => [r.athlete_id, r]));
  const scoringType = heat.wods!.scoring_type;

  return (
    <div>
      <Link href={`/admin/events/${eventId}/heats`} className="mb-4 inline-block text-sm text-black/50 hover:text-repone-red">
        ← All heats
      </Link>
      <h1 className="mb-1 text-2xl font-bold">
        {heat.wods?.name} — Heat {heat.heat_number}
        {heat.heat_count ? ` / ${heat.heat_count}` : ""}
      </h1>
      <p className="mb-6 text-sm uppercase tracking-wide text-black/50">
        {heat.divisions?.name} · {heat.floors?.name} · {scoringType.replace("_", " ")}
        {heat.wods?.time_cap_seconds ? ` · ${heat.wods.time_cap_seconds / 60} min cap` : ""}
      </p>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-semibold uppercase tracking-wide text-black/60">Lane Assignment</h2>
          <div className="flex flex-col gap-2">
            {(lanes ?? []).map((lane) => (
              <form
                key={lane.id}
                action={assignLane.bind(null, eventId, heatId, lane.id)}
                className="flex items-center gap-3 rounded-lg border border-black/10 px-3 py-2"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-repone-black text-sm font-bold text-white">
                  {lane.lane_number}
                </span>
                <select name="athlete_id" defaultValue={lane.athlete_id ?? ""} className="flex-1 rounded-md border border-black/20 px-2 py-1.5 text-sm">
                  <option value="">— empty —</option>
                  {(registrations ?? []).map((r) => (
                    <option key={r.athlete_id} value={r.athlete_id ?? ""}>
                      {r.athletes?.first_name} {r.athletes?.last_name}
                    </option>
                  ))}
                </select>
                <button className="text-xs font-semibold uppercase text-repone-red">Save</button>
              </form>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-semibold uppercase tracking-wide text-black/60">Results Entry</h2>
          <div className="flex flex-col gap-3">
            {(lanes ?? [])
              .filter((l) => l.athlete_id)
              .map((lane) => {
                const existing = resultByAthlete.get(lane.athlete_id);
                return (
                  <form
                    key={lane.id}
                    action={enterResult.bind(null, eventId, heatId, heat.wod_id, heat.division_id, scoringType)}
                    className="rounded-lg border border-black/10 p-3"
                  >
                    <input type="hidden" name="competitor_type" value="athlete" />
                    <input type="hidden" name="competitor_id" value={lane.athlete_id ?? ""} />
                    <p className="mb-2 text-sm font-semibold">
                      Lane {lane.lane_number} — {lane.athletes?.first_name} {lane.athletes?.last_name}
                    </p>
                    <div className="flex flex-wrap items-end gap-2">
                      {scoringType === "for_time" && (
                        <>
                          <label className="flex flex-col text-xs">
                            Time (mm:ss or seconds)
                            <input
                              name="time_seconds"
                              type="number"
                              step="0.01"
                              defaultValue={existing?.time_seconds ?? ""}
                              className="w-28 rounded-md border border-black/20 px-2 py-1"
                            />
                          </label>
                          <label className="flex items-center gap-1 text-xs">
                            <input name="capped" type="checkbox" defaultChecked={existing?.capped ?? false} />
                            Capped
                          </label>
                          <label className="flex flex-col text-xs">
                            Reps (if capped)
                            <input
                              name="reps"
                              type="number"
                              defaultValue={existing?.reps ?? ""}
                              className="w-24 rounded-md border border-black/20 px-2 py-1"
                            />
                          </label>
                        </>
                      )}
                      {scoringType === "amrap" && (
                        <label className="flex flex-col text-xs">
                          Total reps
                          <input
                            name="reps"
                            type="number"
                            defaultValue={existing?.reps ?? ""}
                            className="w-24 rounded-md border border-black/20 px-2 py-1"
                          />
                        </label>
                      )}
                      {scoringType === "max_load" && (
                        <label className="flex flex-col text-xs">
                          Load
                          <input
                            name="load"
                            type="number"
                            step="0.5"
                            defaultValue={existing?.load ?? ""}
                            className="w-24 rounded-md border border-black/20 px-2 py-1"
                          />
                        </label>
                      )}
                      {(scoringType === "points" || scoringType === "other") && (
                        <label className="flex flex-col text-xs">
                          Points
                          <input
                            name="points"
                            type="number"
                            step="0.01"
                            defaultValue={existing?.points ?? ""}
                            className="w-24 rounded-md border border-black/20 px-2 py-1"
                          />
                        </label>
                      )}
                      <label className="flex flex-col text-xs">
                        Tie-break
                        <input
                          name="tiebreak_value"
                          type="number"
                          step="0.01"
                          defaultValue={existing?.tiebreak_value ?? ""}
                          className="w-24 rounded-md border border-black/20 px-2 py-1"
                        />
                      </label>
                      <label className="flex flex-col text-xs">
                        Status
                        <select name="status" defaultValue={existing?.status ?? "completed"} className="rounded-md border border-black/20 px-2 py-1">
                          <option value="completed">Completed</option>
                          <option value="dnf">DNF</option>
                          <option value="dns">DNS</option>
                          <option value="dq">DQ</option>
                        </select>
                      </label>
                      <button className="control-btn control-btn-red px-4 py-2 text-xs">Save</button>
                    </div>
                  </form>
                );
              })}
            {(lanes ?? []).filter((l) => l.athlete_id).length === 0 && (
              <p className="text-sm text-black/50">Assign athletes to lanes first.</p>
            )}
          </div>
        </section>
      </div>

      {standings && standings.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-semibold uppercase tracking-wide text-black/60">
            Live Standings — {heat.wods?.name} ({heat.divisions?.name})
          </h2>
          <div className="flex flex-col gap-1">
            {standings.map((s, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-black/10 px-4 py-2 text-sm">
                <span>
                  <span className="mr-3 font-bold text-repone-red">{s.placement ?? "—"}</span>
                  {s.athletes?.first_name} {s.athletes?.last_name}
                </span>
                <span className="font-semibold">{s.points ?? "—"} pts</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
