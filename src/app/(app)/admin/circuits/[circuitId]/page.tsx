import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { addEventToCircuit, removeEventFromCircuit } from "@/lib/actions/circuits";
import { computeOverallStandings, type RankedResult } from "@/lib/scoring";

/**
 * Circuit-wide leaderboard, computed live on every page load — no stored
 * "circuit_standings" table, nothing to keep in sync. It reuses the same
 * per-division "overall for this event" standings rows
 * (`standings.wod_id is null`) the scoring engine already maintains after
 * every result entry, and aggregates them across events with the exact same
 * placement-based points method `computeOverallStandings` already uses to
 * combine multiple WODs into one event's overall standings — just applied
 * one level up (events instead of WODs). See 0008_circuits.sql for the
 * reasoning and its limits (competitors are matched by their stable
 * athlete_id/team_id; divisions are matched across events by name, so a
 * circuit only works cleanly if the same division names — e.g. "Rx Male" —
 * are reused at every stop).
 */
export default async function CircuitDetailPage({
  params,
}: {
  params: Promise<{ circuitId: string }>;
}) {
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
        .select("division_id, athlete_id, team_id, placement, points")
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

  // Look up display names for every athlete/team that shows up anywhere above.
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
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{circuit.name}</h1>
          {circuit.description && <p className="text-sm text-black/50">{circuit.description}</p>}
          {(circuit.starts_on || circuit.ends_on) && (
            <p className="text-sm text-black/40">
              {circuit.starts_on ?? "—"}{" "}
              {circuit.ends_on && circuit.ends_on !== circuit.starts_on
                ? `→ ${circuit.ends_on}`
                : ""}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href={`/live/circuits/${circuitId}`}
            target="_blank"
            className="text-sm text-repone-red hover:underline"
          >
            Public Leaderboard (share this link) →
          </Link>
          <Link href="/admin/circuits" className="text-sm text-black/50 hover:text-repone-red">
            ← All circuits
          </Link>
        </div>
      </div>

      <div className="mb-8 rounded-lg border border-black/10 p-4">
        <h2 className="mb-3 font-semibold">Events in this circuit</h2>
        <div className="mb-4 flex flex-col gap-2">
          {(circuitEvents ?? []).map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between rounded-md bg-black/5 px-3 py-2"
            >
              <Link
                href={`/admin/events/${e.id}`}
                className="text-sm font-medium hover:text-repone-red"
              >
                {e.name}
                <span className="ml-2 text-xs uppercase text-black/40">{e.status}</span>
              </Link>
              <form action={removeEventFromCircuit.bind(null, circuitId, e.id)}>
                <button className="text-xs text-black/40 hover:text-repone-red">
                  Remove from circuit
                </button>
              </form>
            </div>
          ))}
          {circuitEvents?.length === 0 && (
            <p className="text-sm text-black/50">
              No events yet — add a standalone event below, or create a new event and select this
              circuit.
            </p>
          )}
        </div>

        {(standaloneEvents ?? []).length > 0 && (
          <form action={addEventToCircuit.bind(null, circuitId)} className="flex items-end gap-2">
            <select name="event_id" className="rounded-md border border-black/20 px-3 py-2 text-sm">
              {(standaloneEvents ?? []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <button className="rounded-md border border-black/20 px-3 py-2 text-sm hover:border-repone-red">
              Add existing event to this circuit
            </button>
          </form>
        )}
      </div>

      <h2 className="mb-3 text-lg font-semibold">Cumulative leaderboard</h2>
      <p className="mb-4 text-sm text-black/50">
        Lower total is better — same placement-as-points method used to combine WODs into one
        event&apos;s standings, applied here across events. Only divisions with at least one
        completed, scored event show up below.
      </p>

      <div className="flex flex-col gap-8">
        {divisionLeaderboards.map((division) => (
          <div key={division.name}>
            <h3 className="mb-2 font-semibold">{division.name}</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse text-sm">
                <thead>
                  <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-black/50">
                    <th className="py-2 pr-4">Place</th>
                    <th className="py-2 pr-4">Competitor</th>
                    {(circuitEvents ?? []).map((e) => (
                      <th key={e.id} className="py-2 pr-4">
                        {e.name}
                      </th>
                    ))}
                    <th className="py-2 pr-4">Total points</th>
                  </tr>
                </thead>
                <tbody>
                  {division.standings.map((entry) => {
                    const placementByEvent = new Map(
                      entry.placements.map((p) => [p.wodId, p.placement]),
                    );
                    return (
                      <tr key={entry.competitorId} className="border-b border-black/5">
                        <td className="py-2 pr-4 font-semibold">{entry.overallPlacement}</td>
                        <td className="py-2 pr-4">{entry.displayName}</td>
                        {(circuitEvents ?? []).map((e) => (
                          <td key={e.id} className="py-2 pr-4 text-black/60">
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
          <p className="text-black/50">
            No scored results yet across this circuit&apos;s events — the leaderboard fills in as
            each event&apos;s heats are finished.
          </p>
        )}
      </div>
    </div>
  );
}
