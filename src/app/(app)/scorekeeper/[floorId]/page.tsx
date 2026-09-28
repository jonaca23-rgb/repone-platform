import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getFloorContext } from "@/lib/db/queries";
import { getSessionContext } from "@/lib/auth/session";
import { isAssignedToEvent } from "@/lib/auth/eventRoles";
import { ScoreKeeperClient, type ScoreKeeperResult, type ScoreKeeperStanding } from "./ScoreKeeperClient";

export default async function ScoreKeeperPage({ params }: { params: Promise<{ floorId: string }> }) {
  const { floorId } = await params;
  const context = await getFloorContext(floorId);
  if (!context) notFound();

  // Defense in depth: /scorekeeper/events/[eventId] already only links here
  // for events the signed-in user is assigned to, but this floor URL is
  // reachable directly too (bookmarked, guessed, an old link) — so check
  // the same assignment here. RLS (0024_event_role_assignments.sql) already
  // stops an unassigned user from actually writing a score either way; this
  // is what turns that into a clear redirect instead of a page that loads
  // but silently fails to save.
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  // A producer can also enter/correct scores for their assigned event
  // ("Score corrections" in the spec), so this accepts either assignment.
  const allowed =
    (await isAssignedToEvent(ctx, context.eventId, "scorekeeper")) ||
    (await isAssignedToEvent(ctx, context.eventId, "producer"));
  if (!allowed) redirect("/scorekeeper");

  const heatIds = context.heats.map((h) => h.id);
  // One WOD/division can span several heats — dedupe so we only query
  // standings once per WOD+division, not once per heat.
  const wodDivisionPairs = Array.from(
    new Map(
      context.heats.map((h) => [`${h.wod.id}:${h.division.id}`, { wodId: h.wod.id, divisionId: h.division.id }])
    ).values()
  );

  const supabase = await createClient();
  const [{ data: broadcastState }, { data: resultsRaw }, standingsResults] = await Promise.all([
    supabase.from("broadcast_state").select("*").eq("floor_id", floorId).single(),
    heatIds.length
      ? supabase.from("results").select("*").in("heat_id", heatIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    Promise.all(
      wodDivisionPairs.map((pair) =>
        supabase
          .from("standings")
          .select("placement, points, athlete_id, athletes(first_name, last_name)")
          .eq("division_id", pair.divisionId)
          .eq("wod_id", pair.wodId)
          .order("placement", { ascending: true, nullsFirst: false })
      )
    ),
  ]);

  const resultsByHeatId: Record<string, ScoreKeeperResult[]> = {};
  (resultsRaw ?? []).forEach((r) => {
    const heatId = r.heat_id as string;
    (resultsByHeatId[heatId] ??= []).push(r as unknown as ScoreKeeperResult);
  });

  // See lib/db/queries.ts header comment: cast the many-to-one embed back to a single object.
  const standingsByWodDivision = new Map<string, ScoreKeeperStanding[]>();
  wodDivisionPairs.forEach((pair, i) => {
    const rows = (standingsResults[i].data ?? []) as unknown as Array<{
      placement: number | null;
      points: number | null;
      athlete_id: string | null;
      athletes: { first_name: string; last_name: string } | null;
    }>;
    standingsByWodDivision.set(
      `${pair.wodId}:${pair.divisionId}`,
      rows.map((r) => ({
        placement: r.placement,
        points: r.points,
        athlete_id: r.athlete_id,
        name: r.athletes ? `${r.athletes.first_name} ${r.athletes.last_name}` : "—",
      }))
    );
  });

  const standingsByHeatId: Record<string, ScoreKeeperStanding[]> = {};
  context.heats.forEach((h) => {
    standingsByHeatId[h.id] = standingsByWodDivision.get(`${h.wod.id}:${h.division.id}`) ?? [];
  });

  return (
    <ScoreKeeperClient
      floorId={floorId}
      eventId={context.eventId}
      eventName={context.eventName}
      heats={context.heats}
      initialBroadcastState={broadcastState ?? null}
      resultsByHeatId={resultsByHeatId}
      standingsByHeatId={standingsByHeatId}
    />
  );
}
