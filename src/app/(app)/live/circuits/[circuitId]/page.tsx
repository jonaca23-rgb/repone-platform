import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { computeOverallStandings, type RankedResult } from "@/lib/scoring";

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
export default async function LiveCircuitPage({ params }: { params: Promise<{ circuitId: string }> }) {
  const { circuitId } = await params;
  const supabase = await createClient();

  const { data: circuit } = await supabase
    .from("circuits")
    .select("id, name, description, starts_on, ends_on")
    .eq("id", circuitId)
    .single();
  if (!circuit) notFound();

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

  type Row = { eventId: string; competitorId: string; isTeam: boolean; placement: number | null; points: number | null };
  const rowsByDivisionName = new Map<string, { displayName: string; rows: Row[] }>();

  for (const r of standingsRows ?? []) {
    const division = divisionById.get(r.division_id);
    const competitorId = r.athlete_id ?? r.team_id;
    if (!division || !competitorId) continue;
    const key = division.name.trim().toLowerCase();
    const group: { displayName: string; rows: Row[] } =
      rowsByDivisionName.get(key) ?? { displayName: division.name.trim(), rows: [] };
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
      ? supabase.from("athletes").select("id, first_name, last_name").in("id", Array.from(athleteIds))
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
      list.push({ competitorId: row.competitorId, placement: row.placement, wodPoints: row.points });
      byEvent.set(row.eventId, list);
    }

    const overall = computeOverallStandings(
      Array.from(byEvent.entries()).map(([eventId, results]) => ({ wodId: eventId, results }))
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
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-6">
      <div>
        <Link href="/live" className="text-xs uppercase tracking-wide text-white/40 hover:text-white">
          ← All live events
        </Link>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-wide">
          {circuit.name}
        </h1>
        {circuit.description && <p className="text-sm text-white/50">{circuit.description}</p>}
      </div>

      <div className="rounded-xl bg-repone-gray p-5">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-white/50">Stops in this circuit</p>
        <div className="flex flex-col gap-2">
          {(circuitEvents ?? []).map((e) => (
            <Link key={e.id} href={`/live/${e.id}`} className="text-sm font-medium hover:text-repone-red">
              {e.name} <span className="ml-2 text-xs uppercase text-white/40">{e.status}</span>
            </Link>
          ))}
          {(circuitEvents ?? []).length === 0 && <p className="text-sm text-white/50">No events in this circuit yet.</p>}
        </div>
      </div>

      <section className="flex flex-col gap-8">
        <h2 className="text-xs font-bold uppercase tracking-widest text-white/50">Cumulative Leaderboard</h2>
        {divisionLeaderboards.map((division) => (
          <div key={division.name}>
            <h3 className="mb-2 font-semibold uppercase tracking-wide text-repone-red">{division.name}</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-white/40">
                    <th className="py-2 pr-4">Place</th>
                    <th className="py-2 pr-4">Competitor</th>
                    {(circuitEvents ?? []).map((e) => (
                      <th key={e.id} className="py-2 pr-4">
                        {e.name}
                      </th>
                    ))}
                    <th className="py-2 pr-4">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {division.standings.map((entry) => {
                    const placementByEvent = new Map(entry.placements.map((p) => [p.wodId, p.placement]));
                    return (
                      <tr key={entry.competitorId} className="border-b border-white/5">
                        <td className="py-2 pr-4 font-bold text-repone-red">{entry.overallPlacement}</td>
                        <td className="py-2 pr-4">{entry.displayName}</td>
                        {(circuitEvents ?? []).map((e) => (
                          <td key={e.id} className="py-2 pr-4 text-white/60">
                            {placementByEvent.get(e.id) ?? "—"}
                          </td>
                        ))}
                        <td className="py-2 pr-4 font-semibold">{entry.totalPoints}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        {divisionLeaderboards.length === 0 && (
          <p className="text-white/50">
            No scored results yet across this circuit&apos;s events — the leaderboard fills in as each event&apos;s
            heats are finished.
          </p>
        )}
      </section>
    </div>
  );
}
