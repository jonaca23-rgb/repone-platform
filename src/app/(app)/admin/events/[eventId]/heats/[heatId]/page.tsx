import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { saveHeatResults } from "@/lib/actions/results";
import { formatClock } from "@/lib/timer/compute";
import { compareHeatsForRunningOrder } from "@/lib/scoring/divisionOrder";
import { LaneAssignmentForm } from "./LaneAssignmentForm";

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

  // Event-wide heat order, matching the Heats & Lanes list's own ordering —
  // grouped by WOD first, in entry order (a full WOD runs before the next
  // one starts, e.g. Fran before Grace), then within a WOD by division in
  // Jonathan's fixed running order (Scale before Rx, Male before Female),
  // then by heat number within that division — see
  // lib/scoring/divisionOrder.ts. This is the same order that drives the
  // Heats & Lanes list's "Next Up" badge. The Previous/Next arrows below
  // step through this same sequence, across every floor/WOD/division, so a
  // scorekeeper wrapping up one heat can move straight to whichever heat is
  // next without going back to the list.
  const { data: allHeatsRaw } = await supabase
    .from("heats")
    .select("id, heat_number, wods(name, created_at), divisions(name)")
    .eq("event_id", eventId);
  const allHeats = ((allHeatsRaw ?? []) as unknown as Array<{
    id: string;
    heat_number: number;
    wods: { name: string; created_at: string } | null;
    divisions: { name: string } | null;
  }>)
    .slice()
    .sort((a, b) =>
      compareHeatsForRunningOrder(
        { wodCreatedAt: a.wods?.created_at ?? "", divisionName: a.divisions?.name ?? "", heatNumber: a.heat_number },
        { wodCreatedAt: b.wods?.created_at ?? "", divisionName: b.divisions?.name ?? "", heatNumber: b.heat_number }
      )
    );
  const currentIndex = allHeats.findIndex((h) => h.id === heatId);
  const prevHeat = currentIndex > 0 ? allHeats[currentIndex - 1] : null;
  const nextHeat = currentIndex >= 0 && currentIndex < allHeats.length - 1 ? allHeats[currentIndex + 1] : null;

  const [{ data: lanesRaw }, { data: registrationsRaw }, { data: results }, { data: standingsRaw }, { data: otherHeatLanesRaw }] =
    await Promise.all([
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
      // Every OTHER heat for this same WOD+division, with its lane
      // assignments — used to flag (in red, below) an athlete who's already
      // sitting in a lane elsewhere. An athlete only ever runs one heat per
      // WOD/division, so a second one is always a mistake, not a valid
      // double-entry.
      supabase
        .from("heats")
        .select("heat_number, lanes(lane_number, athlete_id)")
        .eq("wod_id", heat.wod_id)
        .eq("division_id", heat.division_id)
        .neq("id", heatId),
    ]);

  const lanes = lanesRaw as unknown as Array<{
    id: string;
    lane_number: number;
    athlete_id: string | null;
    athletes: { first_name: string; last_name: string; affiliate: string | null } | null;
  }> | null;
  const otherHeatLanes = otherHeatLanesRaw as unknown as Array<{
    heat_number: number;
    lanes: Array<{ lane_number: number; athlete_id: string | null }> | null;
  }> | null;

  // athlete_id -> where else they're already assigned (another heat of this
  // WOD/division, or a second lane within this very heat) — used to render
  // the red "already assigned elsewhere" warning below.
  const conflictByAthleteId = new Map<string, string>();
  (otherHeatLanes ?? []).forEach((h) =>
    (h.lanes ?? []).forEach((l) => {
      if (l.athlete_id) {
        conflictByAthleteId.set(l.athlete_id, `Heat ${h.heat_number}, Lane ${l.lane_number}`);
      }
    })
  );
  (lanes ?? []).forEach((l, i) => {
    if (!l.athlete_id) return;
    const dupeInThisHeat = (lanes ?? []).find((other, j) => j !== i && other.athlete_id === l.athlete_id);
    if (dupeInThisHeat) {
      conflictByAthleteId.set(l.athlete_id, `Lane ${dupeInThisHeat.lane_number} (this heat)`);
    }
  });
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
  const laneAthleteIds = (lanes ?? []).filter((l) => l.athlete_id).map((l) => l.athlete_id as string);

  return (
    <div>
      <Link href={`/admin/events/${eventId}/heats`} className="mb-4 inline-block text-sm text-black/50 hover:text-repone-red">
        ← All heats
      </Link>
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-bold">
          {heat.wods?.name} — Heat {heat.heat_number}
          {heat.heat_count ? ` / ${heat.heat_count}` : ""}
        </h1>
        <div className="flex items-center gap-2 text-sm font-semibold">
          {prevHeat ? (
            <Link
              href={`/admin/events/${eventId}/heats/${prevHeat.id}`}
              className="rounded-md border border-black/20 px-3 py-1.5 hover:border-repone-red hover:text-repone-red"
              title={`${prevHeat.wods?.name ?? "WOD"} — Heat ${prevHeat.heat_number}`}
            >
              ← Previous Heat
            </Link>
          ) : (
            <span className="cursor-not-allowed rounded-md border border-black/10 px-3 py-1.5 text-black/30">
              ← Previous Heat
            </span>
          )}
          {nextHeat ? (
            <Link
              href={`/admin/events/${eventId}/heats/${nextHeat.id}`}
              className="rounded-md border border-black/20 px-3 py-1.5 hover:border-repone-red hover:text-repone-red"
              title={`${nextHeat.wods?.name ?? "WOD"} — Heat ${nextHeat.heat_number}`}
            >
              Next Heat →
            </Link>
          ) : (
            <span className="cursor-not-allowed rounded-md border border-black/10 px-3 py-1.5 text-black/30">
              Next Heat →
            </span>
          )}
        </div>
      </div>
      <p className="mb-6 text-sm uppercase tracking-wide text-black/50">
        {heat.divisions?.name} · {heat.floors?.name} · {scoringType.replace("_", " ")}
        {heat.wods?.time_cap_seconds ? ` · ${heat.wods.time_cap_seconds / 60} min cap` : ""}
      </p>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold uppercase tracking-wide text-black/60">Lane Assignment</h2>
            <Link
              href={`/admin/events/${eventId}/heats`}
              className="text-xs font-semibold text-black/40 hover:text-repone-red"
            >
              ← Back to Heats &amp; Lanes
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {(lanes ?? []).map((lane) => (
              <LaneAssignmentForm
                key={lane.id}
                eventId={eventId}
                heatId={heatId}
                lane={lane}
                registrations={registrations ?? []}
                conflictMessage={
                  lane.athlete_id && conflictByAthleteId.get(lane.athlete_id)
                    ? `This athlete is already registered in another lane/heat — ${conflictByAthleteId.get(lane.athlete_id)}. Remove one of the two assignments.`
                    : undefined
                }
              />
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-semibold uppercase tracking-wide text-black/60">Results Entry</h2>
          <p className="mb-3 -mt-2 text-xs text-black/40">
            For backup/manual entry only — this saves scores but no longer finishes the heat. The heat is marked
            Completed from the Score Keeper screen once every lane&apos;s result is entered there.
          </p>
          <form
            action={saveHeatResults.bind(
              null,
              eventId,
              heatId,
              heat.wod_id,
              heat.division_id,
              scoringType,
              heat.floor_id,
              laneAthleteIds
            )}
          >
            <div className="flex flex-col gap-3">
              {(lanes ?? [])
                .filter((l) => l.athlete_id)
                .map((lane) => {
                  const existing = resultByAthlete.get(lane.athlete_id);
                  const id = lane.athlete_id as string;
                  return (
                    <div key={lane.id} className="rounded-lg border border-black/10 p-3">
                      <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                        Lane {lane.lane_number} — {lane.athletes?.first_name} {lane.athletes?.last_name}
                        {existing?.manually_adjusted && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                            ✎ Adjusted
                          </span>
                        )}
                      </p>
                      <div className="flex flex-wrap items-end gap-2">
                        {scoringType === "for_time" && (
                          <>
                            <label className="flex flex-col text-xs">
                              Time (mm:ss)
                              <input
                                name={`time_seconds__${id}`}
                                type="text"
                                inputMode="decimal"
                                pattern="[0-9]+:[0-5]?[0-9](\.[0-9]+)?|[0-9]+(\.[0-9]+)?"
                                placeholder="3:45"
                                defaultValue={existing?.time_seconds != null ? formatClock(existing.time_seconds) : ""}
                                className="w-28 rounded-md border border-black/20 px-2 py-1"
                              />
                            </label>
                            <label className="flex items-center gap-1 text-xs">
                              <input name={`capped__${id}`} type="checkbox" defaultChecked={existing?.capped ?? false} />
                              Capped
                            </label>
                            <label className="flex flex-col text-xs">
                              Reps (if capped)
                              <input
                                name={`reps__${id}`}
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
                              name={`reps__${id}`}
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
                              name={`load__${id}`}
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
                              name={`points__${id}`}
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
                            name={`tiebreak_value__${id}`}
                            type="number"
                            step="0.01"
                            defaultValue={existing?.tiebreak_value ?? ""}
                            className="w-24 rounded-md border border-black/20 px-2 py-1"
                          />
                        </label>
                        <label className="flex flex-col text-xs">
                          Status
                          <select
                            name={`status__${id}`}
                            defaultValue={existing?.status ?? "completed"}
                            className="rounded-md border border-black/20 px-2 py-1"
                          >
                            <option value="completed">Completed</option>
                            <option value="dnf">DNF</option>
                            <option value="dns">DNS</option>
                            <option value="dq">DQ</option>
                          </select>
                        </label>
                        <label
                          className="flex items-center gap-1 text-xs text-amber-800"
                          title="Check this when correcting a result after the fact (e.g. a claim/protest resolved after the heat) — the record will be marked as manually adjusted."
                        >
                          <input
                            name={`manual_adjustment__${id}`}
                            type="checkbox"
                            defaultChecked={existing?.manually_adjusted ?? false}
                          />
                          Manual Adjustment
                        </label>
                      </div>
                    </div>
                  );
                })}
              {(lanes ?? []).filter((l) => l.athlete_id).length === 0 && (
                <p className="text-sm text-black/50">Assign athletes to lanes first.</p>
              )}
            </div>
            {laneAthleteIds.length > 0 && (
              <button className="control-btn control-btn-red mt-4 w-full px-4 py-3 text-sm">
                Save All
              </button>
            )}
          </form>
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
