import { circuitCompetitorKey } from "@/lib/scoring/circuitKey";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { computeOverallStandings, type RankedResult } from "@/lib/scoring";
import { DetailHeader } from "@/components/app/DetailHeader";
import { LinkTabs } from "@/components/app/LinkTabs";
import { AdminBreadcrumb } from "@/components/shells/AdminBreadcrumb";
import { pickTab } from "@/lib/tabs";
import { formatDayRange } from "@/lib/time";
import { AddCircuitEvent } from "./AddCircuitEventForm";
import { CircuitEventsTable } from "./CircuitEventsTable";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Props = {
  params: Promise<{ circuitId: string }>;
  searchParams: Promise<{ tab?: string }>;
};

const TABS = [
  { value: "events", label: "Events" },
  { value: "standings", label: "Standings" },
] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { circuitId } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("circuits").select("name").eq("id", circuitId).maybeSingle();
  return { title: data?.name ?? "Circuit" };
}

/**
 * Circuit-wide leaderboard, computed live on every page load — no stored
 * "circuit_standings" table, nothing to keep in sync. It reuses the same
 * per-division "overall for this event" standings rows
 * (`standings.wod_id is null`) the scoring engine already maintains after
 * every result entry, and aggregates them across events with the exact same
 * placement-based points method `computeOverallStandings` already uses to
 * combine multiple WODs into one event's overall standings — just applied
 * one level up (events instead of WODs). See 0008_circuits.sql for the
 * reasoning and its limits (athletes are matched by their stable id and
 * teams, which are created per event since 0036, by name — see
 * lib/scoring/circuitKey.ts; divisions are matched across events by name, so a
 * circuit only works cleanly if the same division names — e.g. "Rx Male" —
 * are reused at every stop).
 */
export default async function CircuitDetailPage({ params, searchParams }: Props) {
  const { circuitId } = await params;
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data: circuit } = await supabase
    .from("circuits")
    .select("id, name, description, starts_on, ends_on")
    .eq("id", circuitId)
    .single();
  if (!circuit) notFound();

  const [{ data: circuitEvents }, { data: standaloneEvents }] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, status, starts_on, ends_on")
      .eq("circuit_id", circuitId)
      .order("starts_on", { ascending: true, nullsFirst: false }),
    supabase
      .from("events")
      .select("id, name")
      .eq("organization_id", ctx?.organizationId ?? "")
      .is("circuit_id", null)
      .order("name"),
  ]);

  const eventIds = (circuitEvents ?? []).map((e) => e.id);

  const { data: divisions } = eventIds.length
    ? await supabase.from("divisions").select("id, event_id, name").in("event_id", eventIds)
    : { data: [] as { id: string; event_id: string; name: string }[] };

  const divisionIds = (divisions ?? []).map((d) => d.id);
  const divisionById = new Map((divisions ?? []).map((d) => [d.id, d]));

  const { data: standingsRows } = divisionIds.length
    ? await supabase
        .from("standings")
        .select("division_id, athlete_id, team_id, placement, points, teams(name)")
        .in("division_id", divisionIds)
        .is("wod_id", null)
    : {
        data: [] as {
          division_id: string;
          athlete_id: string | null;
          team_id: string | null;
          placement: number | null;
          points: number | null;
        }[],
      };

  // Group standings rows by normalized division name, then by event, so each
  // division-name group can be fed through computeOverallStandings.
  type StandingRow = {
    division_id: string;
    athlete_id: string | null;
    team_id: string | null;
    placement: number | null;
    points: number | null;
    teams: { name: string } | null;
  };
  type Row = {
    eventId: string;
    competitorId: string;
    isTeam: boolean;
    placement: number | null;
    points: number | null;
  };
  const rowsByDivisionName = new Map<string, { displayName: string; rows: Row[] }>();

  // Teams are created per event, so a team is matched across stops by name.
  const teamNameByKey = new Map<string, string>();
  for (const r of (standingsRows ?? []) as unknown as StandingRow[]) {
    const division = divisionById.get(r.division_id);
    const competitorId = circuitCompetitorKey({
      athleteId: r.athlete_id,
      teamId: r.team_id,
      teamName: r.teams?.name ?? null,
    });
    if (!division || !competitorId) continue;
    if (r.team_id && !teamNameByKey.has(competitorId)) {
      teamNameByKey.set(competitorId, r.teams?.name.trim() ?? "Unknown team");
    }
    const key = division.name.trim().toLowerCase();
    const group: { displayName: string; rows: Row[] } = rowsByDivisionName.get(key) ?? {
      displayName: division.name.trim(),
      rows: [],
    };
    group.rows.push({
      eventId: division.event_id,
      competitorId,
      isTeam: !!r.team_id,
      placement: r.placement,
      points: r.points,
    });
    rowsByDivisionName.set(key, group);
  }

  // Look up display names for every athlete/team that shows up anywhere above.
  const athleteIds = new Set<string>();
  for (const group of rowsByDivisionName.values()) {
    for (const row of group.rows) if (!row.isTeam) athleteIds.add(row.competitorId);
  }
  const { data: athletes } = athleteIds.size
    ? await supabase
        .from("athletes")
        .select("id, first_name, last_name")
        .in("id", Array.from(athleteIds))
    : { data: [] as { id: string; first_name: string; last_name: string }[] };
  const nameById = new Map<string, string>();
  for (const a of athletes ?? []) nameById.set(a.id, `${a.first_name} ${a.last_name}`);
  for (const [key, name] of teamNameByKey) nameById.set(key, name);

  const divisionLeaderboards = Array.from(rowsByDivisionName.values()).map((group) => {
    const byEvent = new Map<string, RankedResult[]>();
    for (const row of group.rows) {
      const list = byEvent.get(row.eventId) ?? [];
      list.push({
        competitorId: row.competitorId,
        placement: row.placement,
        wodPoints: row.points,
      });
      byEvent.set(row.eventId, list);
    }

    const overall = computeOverallStandings(
      Array.from(byEvent.entries()).map(([eventId, results]) => ({ wodId: eventId, results })),
    );

    return {
      name: group.displayName,
      standings: overall.map((entry) => ({
        ...entry,
        displayName: nameById.get(entry.competitorId) ?? "Unknown competitor",
      })),
    };
  });

  const season =
    circuit.starts_on || circuit.ends_on
      ? formatDayRange(circuit.starts_on ?? circuit.ends_on, circuit.ends_on, " → ")
      : null;
  const subtitle = [circuit.description, season].filter(Boolean).join(" · ") || undefined;
  const tab = pickTab(TABS, (await searchParams).tab);

  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        title={circuit.name}
        subtitle={subtitle}
        breadcrumb={
          <AdminBreadcrumb
            items={[{ label: "Circuits", href: "/admin/circuits" }, { label: circuit.name }]}
          />
        }
        actions={
          <>
            <AddCircuitEvent circuitId={circuitId} events={standaloneEvents ?? []} />
            <Button asChild variant="outline">
              <Link href={`/live/circuits/${circuitId}`} target="_blank">
                Public leaderboard
              </Link>
            </Button>
          </>
        }
      />

      <LinkTabs tabs={TABS} current={tab} label={`${circuit.name} sections`}>
        {tab === "events" ? (
          <CircuitEventsTable
            circuitId={circuitId}
            circuitName={circuit.name}
            rows={(circuitEvents ?? []).map((e) => ({
              id: e.id,
              name: e.name,
              status: e.status,
              startsOn: e.starts_on,
              endsOn: e.ends_on,
            }))}
          />
        ) : (
          <section className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold">Cumulative leaderboard</h2>
              <p className="text-sm text-muted-foreground">
                Lower total is better: the same placement-as-points method used to combine WODs into
                one event&apos;s standings, applied here across events. Only divisions with at least
                one completed, scored event show up below. Athletes are the same record at every
                stop; teams are created per event, so a team is matched across stops by its name.
              </p>
            </div>

            {divisionLeaderboards.map((division) => (
              <div key={division.name}>
                <h3 className="mb-2 font-semibold">{division.name}</h3>
                <Table className="[&_tr]:border-border">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Place</TableHead>
                      <TableHead>Competitor</TableHead>
                      {(circuitEvents ?? []).map((e) => (
                        <TableHead key={e.id}>{e.name}</TableHead>
                      ))}
                      <TableHead>Total points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {division.standings.map((entry) => {
                      const placementByEvent = new Map(
                        entry.placements.map((p) => [p.wodId, p.placement]),
                      );
                      return (
                        <TableRow key={entry.competitorId}>
                          <TableCell className="font-semibold">{entry.overallPlacement}</TableCell>
                          <TableCell>{entry.displayName}</TableCell>
                          {(circuitEvents ?? []).map((e) => (
                            <TableCell key={e.id} className="text-muted-foreground">
                              {placementByEvent.get(e.id) ?? "—"}
                            </TableCell>
                          ))}
                          <TableCell className="font-semibold">{entry.totalPoints}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ))}
            {divisionLeaderboards.length === 0 && (
              <p className="text-muted-foreground">
                No scored results yet across this circuit&apos;s events. The leaderboard fills in as
                each event&apos;s heats are finished.
              </p>
            )}
          </section>
        )}
      </LinkTabs>
    </div>
  );
}
