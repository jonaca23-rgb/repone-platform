import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { compareHeatsForRunningOrder } from "@/lib/scoring/divisionOrder";
import { DetailHeader } from "@/components/app/DetailHeader";
import { LinkTabs } from "@/components/app/LinkTabs";
import { pickTab } from "@/lib/tabs";
import { AdminBreadcrumb, eventCrumbs } from "@/components/shells/AdminBreadcrumb";
import { Button } from "@/components/ui/button";
import { getAdminEvent, requireAdminEvent } from "../../adminEvent";
import { LaneAssignmentForm, type LaneOption } from "./LaneAssignmentForm";
import { LaneScoring } from "@/components/scoring/LaneScoring";
import {
  type LaneResult,
  type ScoringLane,
  type ScoringType,
  scoringLabel,
  standingName,
} from "@/lib/scoring/format";
import { laneCompetitor } from "@/lib/db/floorLanes";

type Props = {
  params: Promise<{ eventId: string; heatId: string }>;
  searchParams: Promise<{ tab?: string }>;
};

const TABS = [
  { value: "lanes", label: "Lanes" },
  { value: "results", label: "Results" },
  { value: "standings", label: "Standings" },
] as const;

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

export default async function HeatDetailPage({ params, searchParams }: Props) {
  const { eventId, heatId } = await params;
  const supabase = await createClient();
  const event = await requireAdminEvent(eventId);

  const { data: heatRaw } = await supabase
    .from("heats")
    .select(
      "id, heat_number, heat_count, division_id, wod_id, floor_id, ended_at, wods(name, scoring_type, time_cap_seconds), divisions(name, entry_format), floors(name)",
    )
    .eq("id", heatId)
    .single();
  // See lib/db/queries.ts header comment: cast many-to-one embeds back to single objects.
  const heat = heatRaw as unknown as {
    id: string;
    ended_at: string | null;
    heat_number: number;
    heat_count: number | null;
    division_id: string;
    wod_id: string;
    floor_id: string;
    wods: {
      name: string;
      scoring_type: ScoringType;
      time_cap_seconds: number | null;
    } | null;
    divisions: { name: string; entry_format: string } | null;
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
      .select(
        "id, lane_number, athlete_id, team_id, athletes(first_name, last_name, affiliate), teams(name, affiliate)",
      )
      .eq("heat_id", heatId)
      .order("lane_number"),
    supabase
      .from("registrations")
      .select("athlete_id, team_id, athletes(id, first_name, last_name), teams(id, name)")
      .eq("division_id", heat.division_id),
    supabase.from("results").select("*").eq("heat_id", heatId),
    supabase
      .from("standings")
      .select(
        "placement, points, athlete_id, team_id, athletes(first_name, last_name), teams(name)",
      )
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
      .select("heat_number, lanes(lane_number, athlete_id, team_id)")
      .eq("wod_id", heat.wod_id)
      .eq("division_id", heat.division_id)
      .neq("id", heatId),
  ]);

  const lanes = lanesRaw as unknown as Array<{
    id: string;
    lane_number: number;
    athlete_id: string | null;
    team_id: string | null;
    athletes: { first_name: string; last_name: string; affiliate: string | null } | null;
    teams: { name: string; affiliate: string | null } | null;
  }> | null;
  const otherHeatLanes = otherHeatLanesRaw as unknown as Array<{
    heat_number: number;
    lanes: Array<{ lane_number: number; athlete_id: string | null; team_id: string | null }> | null;
  }> | null;

  // athlete or team id -> where else they're already assigned (another heat
  // of this WOD/division, or a second lane within this very heat) — used to
  // render the red "already assigned elsewhere" warning below.
  const occupant = (l: { athlete_id: string | null; team_id: string | null }) =>
    l.athlete_id ?? l.team_id;
  const conflictByCompetitorId = new Map<string, string>();
  (otherHeatLanes ?? []).forEach((h) =>
    (h.lanes ?? []).forEach((l) => {
      const id = occupant(l);
      if (id) conflictByCompetitorId.set(id, `Heat ${h.heat_number}, Lane ${l.lane_number}`);
    }),
  );
  (lanes ?? []).forEach((l, i) => {
    const id = occupant(l);
    if (!id) return;
    const dupeInThisHeat = (lanes ?? []).find((other, j) => j !== i && occupant(other) === id);
    if (dupeInThisHeat) {
      conflictByCompetitorId.set(id, `Lane ${dupeInThisHeat.lane_number} (this heat)`);
    }
  });
  const registrations = registrationsRaw as unknown as Array<{
    athlete_id: string | null;
    team_id: string | null;
    athletes: { id: string; first_name: string; last_name: string } | null;
    teams: { id: string; name: string } | null;
  }> | null;
  // What this heat's lanes hold: the division's athletes, or its teams.
  const laneOptions: LaneOption[] = (registrations ?? []).flatMap((r) =>
    r.athletes
      ? [{ id: r.athletes.id, label: `${r.athletes.first_name} ${r.athletes.last_name}` }]
      : r.teams
        ? [{ id: r.teams.id, label: r.teams.name }]
        : [],
  );
  const holdsTeams = !!heat.divisions && heat.divisions.entry_format !== "individual";
  const standings = standingsRaw as unknown as Array<{
    placement: number | null;
    points: number | null;
    athlete_id: string | null;
    team_id: string | null;
    athletes: { first_name: string; last_name: string } | null;
    teams: { name: string } | null;
  }> | null;

  const scoringType = heat.wods!.scoring_type;
  const scoringLanes: ScoringLane[] = (lanes ?? []).flatMap((l) => {
    const competitor = laneCompetitor({ athleteId: l.athlete_id, teamId: l.team_id });
    if (!competitor) return [];
    return [
      {
        laneNumber: l.lane_number,
        competitorType: competitor.type,
        competitorId: competitor.id,
        name: l.athletes
          ? `${l.athletes.first_name} ${l.athletes.last_name}`
          : (l.teams?.name ?? "—"),
        affiliate: l.athletes ? l.athletes.affiliate : (l.teams?.affiliate ?? null),
      },
    ];
  });

  const tab = pickTab(TABS, (await searchParams).tab);
  const title = `${heat.wods?.name} — Heat ${heat.heat_number}${heat.heat_count ? ` / ${heat.heat_count}` : ""}`;

  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        title={title}
        subtitle={`${heat.divisions?.name} · ${heat.floors?.name} · ${scoringLabel(scoringType)}${heat.wods?.time_cap_seconds ? ` · ${heat.wods.time_cap_seconds / 60} min cap` : ""}`}
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

      <LinkTabs tabs={TABS} current={tab} label="Heat sections">
        {tab === "lanes" ? (
          <section>
            <div className="flex flex-col gap-2">
              {(lanes ?? []).map((lane) => (
                <LaneAssignmentForm
                  key={lane.id}
                  eventId={eventId}
                  heatId={heatId}
                  lane={{
                    id: lane.id,
                    lane_number: lane.lane_number,
                    occupantId: occupant(lane),
                  }}
                  kind={holdsTeams ? "team" : "athlete"}
                  options={laneOptions}
                  conflictMessage={
                    occupant(lane) && conflictByCompetitorId.get(occupant(lane) as string)
                      ? `This ${lane.team_id ? "team" : "athlete"} is already in another lane/heat — ${conflictByCompetitorId.get(occupant(lane) as string)}. Remove one of the two assignments.`
                      : undefined
                  }
                />
              ))}
            </div>
          </section>
        ) : tab === "results" ? (
          <section className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {heat.ended_at
                ? "This heat is finished. Only admins and event directors can correct its results; saving here updates the standings."
                : "Saving here doesn't finish the heat. The heat is marked Completed from the Score Keeper screen."}
            </p>
            {scoringLanes.length > 0 ? (
              <LaneScoring
                heatId={heatId}
                lanes={scoringLanes}
                results={(results ?? []) as unknown as LaneResult[]}
                scoringType={scoringType as ScoringType}
                subtitle={`${heat.wods?.name ?? "WOD"} · ${heat.divisions?.name ?? ""}`}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Assign athletes or teams to lanes first.
              </p>
            )}
          </section>
        ) : standings && standings.length > 0 ? (
          <section>
            <p className="mb-3 text-sm text-muted-foreground">
              Live standings — {heat.wods?.name} ({heat.divisions?.name})
            </p>
            <div className="flex flex-col gap-1">
              {standings.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2 text-sm"
                >
                  <span>
                    <span className="mr-3 font-bold text-brand-text">{s.placement ?? "—"}</span>
                    {standingName(s)}
                  </span>
                  <span className="font-semibold">{s.points ?? "—"} pts</span>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <p className="text-muted-foreground">No standings yet for this WOD and division.</p>
        )}
      </LinkTabs>
    </div>
  );
}
