import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, PencilLine } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { saveHeatResults } from "@/lib/actions/results";
import { formatClock } from "@/lib/timer/compute";
import { compareHeatsForRunningOrder } from "@/lib/scoring/divisionOrder";
import { PageHeader } from "@/components/app/PageHeader";
import { AdminBreadcrumb, eventCrumbs } from "@/components/shells/AdminBreadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAdminEvent, requireAdminEvent } from "../../adminEvent";
import { LaneAssignmentForm } from "./LaneAssignmentForm";

type Props = { params: Promise<{ eventId: string; heatId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { eventId, heatId } = await params;
  const supabase = await createClient();
  const [event, { data }] = await Promise.all([
    getAdminEvent(eventId),
    supabase.from("heats").select("heat_number, wods(name)").eq("id", heatId).maybeSingle(),
  ]);
  const heat = data as unknown as { heat_number: number; wods: { name: string } | null } | null;
  const page = heat ? `${heat.wods?.name ?? "WOD"} Heat ${heat.heat_number}` : "Heat";
  return { title: event ? `${page} · ${event.name}` : page };
}

export default async function HeatDetailPage({ params }: Props) {
  const { eventId, heatId } = await params;
  const supabase = await createClient();
  const event = await requireAdminEvent(eventId);

  const { data: heatRaw } = await supabase
    .from("heats")
    .select(
      "id, heat_number, heat_count, division_id, wod_id, floor_id, wods(name, scoring_type, time_cap_seconds), divisions(name), floors(name)",
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
    wods: {
      name: string;
      scoring_type: "for_time" | "amrap" | "max_load" | "points" | "other";
      time_cap_seconds: number | null;
    } | null;
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
  const allHeats = (
    (allHeatsRaw ?? []) as unknown as Array<{
      id: string;
      heat_number: number;
      wods: { name: string; created_at: string } | null;
      divisions: { name: string } | null;
    }>
  )
    .slice()
    .sort((a, b) =>
      compareHeatsForRunningOrder(
        {
          wodCreatedAt: a.wods?.created_at ?? "",
          divisionName: a.divisions?.name ?? "",
          heatNumber: a.heat_number,
        },
        {
          wodCreatedAt: b.wods?.created_at ?? "",
          divisionName: b.divisions?.name ?? "",
          heatNumber: b.heat_number,
        },
      ),
    );
  const currentIndex = allHeats.findIndex((h) => h.id === heatId);
  const prevHeat = currentIndex > 0 ? allHeats[currentIndex - 1] : null;
  const nextHeat =
    currentIndex >= 0 && currentIndex < allHeats.length - 1 ? allHeats[currentIndex + 1] : null;

  const [
    { data: lanesRaw },
    { data: registrationsRaw },
    { data: results },
    { data: standingsRaw },
    { data: otherHeatLanesRaw },
  ] = await Promise.all([
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
    }),
  );
  (lanes ?? []).forEach((l, i) => {
    if (!l.athlete_id) return;
    const dupeInThisHeat = (lanes ?? []).find(
      (other, j) => j !== i && other.athlete_id === l.athlete_id,
    );
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
  const laneAthleteIds = (lanes ?? [])
    .filter((l) => l.athlete_id)
    .map((l) => l.athlete_id as string);

  const title = `${heat.wods?.name} — Heat ${heat.heat_number}${heat.heat_count ? ` / ${heat.heat_count}` : ""}`;
  const fieldClass = "w-28 text-base";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        description={`${heat.divisions?.name} · ${heat.floors?.name} · ${scoringType.replace("_", " ")}${heat.wods?.time_cap_seconds ? ` · ${heat.wods.time_cap_seconds / 60} min cap` : ""}`}
        breadcrumb={
          <AdminBreadcrumb
            items={eventCrumbs(
              event,
              { label: "Heats", href: `/admin/events/${eventId}/heats` },
              { label: `${heat.wods?.name ?? "WOD"} Heat ${heat.heat_number}` },
            )}
          />
        }
        actions={
          <>
            {prevHeat ? (
              <Button asChild variant="outline">
                <Link
                  href={`/admin/events/${eventId}/heats/${prevHeat.id}`}
                  title={`${prevHeat.wods?.name ?? "WOD"} — Heat ${prevHeat.heat_number}`}
                >
                  <ChevronLeft aria-hidden />
                  Previous heat
                </Link>
              </Button>
            ) : (
              <Button variant="outline" disabled>
                <ChevronLeft aria-hidden />
                Previous heat
              </Button>
            )}
            {nextHeat ? (
              <Button asChild variant="outline">
                <Link
                  href={`/admin/events/${eventId}/heats/${nextHeat.id}`}
                  title={`${nextHeat.wods?.name ?? "WOD"} — Heat ${nextHeat.heat_number}`}
                >
                  Next heat
                  <ChevronRight aria-hidden />
                </Link>
              </Button>
            ) : (
              <Button variant="outline" disabled>
                Next heat
                <ChevronRight aria-hidden />
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-semibold uppercase tracking-wide text-muted-foreground">
            Lane assignment
          </h2>
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
          <h2 className="mb-1 font-semibold uppercase tracking-wide text-muted-foreground">
            Results entry
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            For backup or manual entry only: this saves scores but doesn&apos;t finish the heat. The
            heat is marked Completed from the Score Keeper screen once every lane&apos;s result is
            entered there.
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
              laneAthleteIds,
            )}
          >
            <div className="flex flex-col gap-3">
              {(lanes ?? [])
                .filter((l) => l.athlete_id)
                .map((lane) => {
                  const existing = resultByAthlete.get(lane.athlete_id);
                  const id = lane.athlete_id as string;
                  const f = (name: string) => `result-${lane.id}-${name}`;
                  return (
                    <div key={lane.id} className="rounded-lg border border-border bg-card p-3">
                      <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                        Lane {lane.lane_number} — {lane.athletes?.first_name}{" "}
                        {lane.athletes?.last_name}
                        {existing?.manually_adjusted && (
                          <Badge className="border-warning/40 bg-warning/10 text-warning-text uppercase">
                            <PencilLine aria-hidden />
                            Adjusted
                          </Badge>
                        )}
                      </p>
                      <div className="flex flex-wrap items-end gap-3">
                        {scoringType === "for_time" && (
                          <>
                            <div className="grid gap-1.5">
                              <Label htmlFor={f("time")} className="text-xs">
                                Time (mm:ss)
                              </Label>
                              <Input
                                id={f("time")}
                                name={`time_seconds__${id}`}
                                type="text"
                                inputMode="decimal"
                                pattern="[0-9]+:[0-5]?[0-9](\.[0-9]+)?|[0-9]+(\.[0-9]+)?"
                                placeholder="3:45"
                                defaultValue={
                                  existing?.time_seconds != null
                                    ? formatClock(existing.time_seconds)
                                    : ""
                                }
                                className={fieldClass}
                              />
                            </div>
                            <div className="flex h-9 items-center gap-2">
                              <Checkbox
                                id={f("capped")}
                                name={`capped__${id}`}
                                defaultChecked={existing?.capped ?? false}
                              />
                              <Label htmlFor={f("capped")} className="text-xs">
                                Capped
                              </Label>
                            </div>
                            <div className="grid gap-1.5">
                              <Label htmlFor={f("reps")} className="text-xs">
                                Reps (if capped)
                              </Label>
                              <Input
                                id={f("reps")}
                                name={`reps__${id}`}
                                type="number"
                                defaultValue={existing?.reps ?? ""}
                                className={fieldClass}
                              />
                            </div>
                          </>
                        )}
                        {scoringType === "amrap" && (
                          <div className="grid gap-1.5">
                            <Label htmlFor={f("reps")} className="text-xs">
                              Total reps
                            </Label>
                            <Input
                              id={f("reps")}
                              name={`reps__${id}`}
                              type="number"
                              defaultValue={existing?.reps ?? ""}
                              className={fieldClass}
                            />
                          </div>
                        )}
                        {scoringType === "max_load" && (
                          <div className="grid gap-1.5">
                            <Label htmlFor={f("load")} className="text-xs">
                              Load
                            </Label>
                            <Input
                              id={f("load")}
                              name={`load__${id}`}
                              type="number"
                              step="0.5"
                              defaultValue={existing?.load ?? ""}
                              className={fieldClass}
                            />
                          </div>
                        )}
                        {(scoringType === "points" || scoringType === "other") && (
                          <div className="grid gap-1.5">
                            <Label htmlFor={f("points")} className="text-xs">
                              Points
                            </Label>
                            <Input
                              id={f("points")}
                              name={`points__${id}`}
                              type="number"
                              step="0.01"
                              defaultValue={existing?.points ?? ""}
                              className={fieldClass}
                            />
                          </div>
                        )}
                        <div className="grid gap-1.5">
                          <Label htmlFor={f("tiebreak")} className="text-xs">
                            Tie-break
                          </Label>
                          <Input
                            id={f("tiebreak")}
                            name={`tiebreak_value__${id}`}
                            type="number"
                            step="0.01"
                            defaultValue={existing?.tiebreak_value ?? ""}
                            className={fieldClass}
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor={f("status")} className="text-xs">
                            Status
                          </Label>
                          <Select
                            name={`status__${id}`}
                            defaultValue={existing?.status ?? "completed"}
                          >
                            <SelectTrigger id={f("status")} className="min-w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="dnf">DNF</SelectItem>
                              <SelectItem value="dns">DNS</SelectItem>
                              <SelectItem value="dq">DQ</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div
                          className="flex h-9 items-center gap-2"
                          title="Check this when correcting a result after the fact (e.g. a claim or protest resolved after the heat). The record is marked as manually adjusted."
                        >
                          <Checkbox
                            id={f("manual")}
                            name={`manual_adjustment__${id}`}
                            defaultChecked={existing?.manually_adjusted ?? false}
                          />
                          <Label htmlFor={f("manual")} className="text-xs text-warning-text">
                            Manual adjustment
                          </Label>
                        </div>
                      </div>
                    </div>
                  );
                })}
              {(lanes ?? []).filter((l) => l.athlete_id).length === 0 && (
                <p className="text-sm text-muted-foreground">Assign athletes to lanes first.</p>
              )}
            </div>
            {laneAthleteIds.length > 0 && (
              <Button type="submit" size="lg" className="mt-4 w-full">
                Save all
              </Button>
            )}
          </form>
        </section>
      </div>

      {standings && standings.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold uppercase tracking-wide text-muted-foreground">
            Live standings — {heat.wods?.name} ({heat.divisions?.name})
          </h2>
          <div className="flex flex-col gap-1">
            {standings.map((s, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2 text-sm"
              >
                <span>
                  <span className="mr-3 font-bold text-brand-text">{s.placement ?? "—"}</span>
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
