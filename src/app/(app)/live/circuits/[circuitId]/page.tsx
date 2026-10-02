import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ArrowLeft, CalendarDays, ListOrdered } from "lucide-react";
import { EmptyState } from "@/components/app/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/db/server";
import { computeOverallStandings, type RankedResult } from "@/lib/scoring";

// One lookup per request, shared by generateMetadata and the page.
const getCircuit = cache(async (circuitId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("circuits")
    .select("id, name, description, starts_on, ends_on")
    .eq("id", circuitId)
    .single();
  return data;
});

type Props = { params: Promise<{ circuitId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const circuit = await getCircuit((await params).circuitId);
  return { title: circuit ? `${circuit.name} standings` : "Circuit not found" };
}

/**
 * Public counterpart to /admin/circuits/[circuitId] — same live aggregation
 * (see that page's header comment for the full reasoning: no stored
 * "circuit_standings" table, `standings.wod_id is null` rows combined across
 * events with the same placement-as-points method used to combine WODs into
 * one event's standings), just unauthenticated and without the
 * add/remove-event management controls. Kept as a separate read path rather
 * than sharing code with the admin page, since the admin page also needs the
 * session-scoped "standalone events" picker this one has no use for.
 */
export default async function LiveCircuitPage({ params }: Props) {
  const { circuitId } = await params;
  const circuit = await getCircuit(circuitId);
  if (!circuit) notFound();
  const supabase = await createClient();

  const { data: circuitEvents } = await supabase
    .from("events")
    .select("id, name, status")
    .eq("circuit_id", circuitId)
    .order("starts_on", { ascending: true, nullsFirst: false });

  const eventIds = (circuitEvents ?? []).map((e) => e.id);

  const { data: divisions } = eventIds.length
    ? await supabase.from("divisions").select("id, event_id, name").in("event_id", eventIds)
    : { data: [] as { id: string; event_id: string; name: string }[] };

  const divisionIds = (divisions ?? []).map((d) => d.id);
  const divisionById = new Map((divisions ?? []).map((d) => [d.id, d]));

  const { data: standingsRows } = divisionIds.length
    ? await supabase
        .from("standings")
        .select("division_id, athlete_id, team_id, placement, points")
        .in("division_id", divisionIds)
        .is("wod_id", null)
    : {
        data: [] as Array<{
          division_id: string;
          athlete_id: string | null;
          team_id: string | null;
          placement: number | null;
          points: number | null;
        }>,
      };

  type Row = {
    eventId: string;
    competitorId: string;
    isTeam: boolean;
    placement: number | null;
    points: number | null;
  };
  const rowsByDivisionName = new Map<string, { displayName: string; rows: Row[] }>();

  for (const r of standingsRows ?? []) {
    const division = divisionById.get(r.division_id);
    const competitorId = r.athlete_id ?? r.team_id;
    if (!division || !competitorId) continue;
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

  const athleteIds = new Set<string>();
  const teamIds = new Set<string>();
  for (const group of rowsByDivisionName.values()) {
    for (const row of group.rows) (row.isTeam ? teamIds : athleteIds).add(row.competitorId);
  }
  const [{ data: athletes }, { data: teams }] = await Promise.all([
    athleteIds.size
      ? supabase
          .from("athletes")
          .select("id, first_name, last_name")
          .in("id", Array.from(athleteIds))
      : Promise.resolve({ data: [] as { id: string; first_name: string; last_name: string }[] }),
    teamIds.size
      ? supabase.from("teams").select("id, name").in("id", Array.from(teamIds))
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const nameById = new Map<string, string>();
  for (const a of athletes ?? []) nameById.set(a.id, `${a.first_name} ${a.last_name}`);
  for (const t of teams ?? []) nameById.set(t.id, t.name);

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

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link
          href="/live"
          className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
        >
          <ArrowLeft className="size-4" aria-hidden />
          All live events
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-wide text-balance uppercase">
          {circuit.name}
        </h1>
        {circuit.description && <p className="text-muted-foreground">{circuit.description}</p>}
      </div>

      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-sm tracking-widest text-muted-foreground uppercase">
            Stops in this circuit
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(circuitEvents ?? []).length > 0 ? (
            <ul className="flex flex-col">
              {(circuitEvents ?? []).map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/live/${e.id}`}
                    className="flex min-h-11 items-center justify-between gap-3 rounded-sm font-medium hover:text-brand-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
                  >
                    {e.name}
                    <span className="text-xs text-muted-foreground uppercase">{e.status}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={CalendarDays} title="No events in this circuit yet" />
          )}
        </CardContent>
      </Card>

      <section aria-labelledby="cumulative" className="flex flex-col gap-8">
        <h2
          id="cumulative"
          className="text-sm font-semibold tracking-widest text-muted-foreground uppercase"
        >
          Cumulative Leaderboard
        </h2>
        {divisionLeaderboards.map((division) => (
          <div key={division.name} className="flex flex-col gap-2">
            <h3 className="font-semibold tracking-wide text-brand-text uppercase">
              {division.name}
            </h3>
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <Table className="[&_tr]:border-border">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-muted-foreground">Place</TableHead>
                    <TableHead className="text-muted-foreground">Competitor</TableHead>
                    {(circuitEvents ?? []).map((e) => (
                      <TableHead key={e.id} className="text-muted-foreground">
                        {e.name}
                      </TableHead>
                    ))}
                    <TableHead className="text-muted-foreground">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {division.standings.map((entry) => {
                    const placementByEvent = new Map(
                      entry.placements.map((p) => [p.wodId, p.placement]),
                    );
                    return (
                      <TableRow key={entry.competitorId}>
                        <TableCell className="font-bold text-brand-text tabular-nums">
                          {entry.overallPlacement}
                        </TableCell>
                        <TableCell>{entry.displayName}</TableCell>
                        {(circuitEvents ?? []).map((e) => (
                          <TableCell key={e.id} className="text-muted-foreground tabular-nums">
                            {placementByEvent.get(e.id) ?? "—"}
                          </TableCell>
                        ))}
                        <TableCell className="font-semibold tabular-nums">
                          {entry.totalPoints}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        ))}
        {divisionLeaderboards.length === 0 && (
          <EmptyState
            icon={ListOrdered}
            title="No scored results yet"
            description="The leaderboard fills in as each event's heats are finished."
          />
        )}
      </section>
    </div>
  );
}
