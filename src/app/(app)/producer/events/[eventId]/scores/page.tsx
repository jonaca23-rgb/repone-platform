import type { Metadata } from "next";
import { createClient } from "@/lib/db/server";
import { PageHeader } from "@/components/app/PageHeader";
import { type LaneResult, type ScoringType, scoreSummary } from "@/lib/scoring/format";
import { producerEventTitle } from "../producerEvent";
import { type ScoreRow, ScoresTable } from "./ScoresTable";

type Props = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: await producerEventTitle((await params).eventId, "Scores") };
}

// Read-only score status across the whole event — "Official/unofficial
// score status" + a way in to "Score corrections" per spec. Producer RLS
// (0024_event_role_assignments.sql) already permits writing results for an
// assigned event, so corrections happen on the existing Score Keeper screen
// for the relevant floor rather than a second results-entry UI here.
export default async function ProducerEventScoresPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();

  const { data: heats } = await supabase
    .from("heats")
    .select("id, floor_id, heat_number, wods(name, scoring_type), divisions(name)")
    .eq("event_id", eventId);

  type HeatRow = {
    id: string;
    floor_id: string;
    heat_number: number;
    wods: { name: string; scoring_type: string } | null;
    divisions: { name: string } | null;
  };
  const heatRows = (heats ?? []) as unknown as HeatRow[];
  const heatIds = heatRows.map((h) => h.id);
  const heatById = new Map(heatRows.map((h) => [h.id, h]));

  const { data: results } = heatIds.length
    ? await supabase
        .from("results")
        .select(
          "id, heat_id, athlete_id, status, manually_adjusted, time_seconds, reps, load, points, capped, tiebreak_value, athletes(first_name, last_name), teams(name)",
        )
        .in("heat_id", heatIds)
    : { data: [] as Array<Record<string, unknown>> };

  type ResultRow = {
    id: string;
    heat_id: string;
    status: string;
    manually_adjusted: boolean;
    athlete_id: string | null;
    time_seconds: number | null;
    reps: number | null;
    load: number | null;
    points: number | null;
    capped: boolean;
    tiebreak_value: number | null;
    athletes: { first_name: string; last_name: string } | null;
    teams: { name: string } | null;
  };
  const resultRows = (results ?? []) as unknown as ResultRow[];
  const scoreRows: ScoreRow[] = resultRows.map((r) => {
    const heat = heatById.get(r.heat_id);
    return {
      id: r.id,
      competitor: r.athletes
        ? `${r.athletes.first_name} ${r.athletes.last_name}`
        : (r.teams?.name ?? "—"),
      wodName: heat?.wods?.name ?? "—",
      heatNumber: heat?.heat_number ?? 0,
      divisionName: heat?.divisions?.name ?? "—",
      score: scoreSummary(
        r as unknown as LaneResult,
        (heat?.wods?.scoring_type ?? "other") as ScoringType,
      ),
      status: r.status,
      adjusted: r.manually_adjusted,
      floorId: heat?.floor_id ?? "",
    };
  });
  const wodNames = [...new Set(scoreRows.map((r) => r.wodName))].sort();
  const divisionNames = [...new Set(scoreRows.map((r) => r.divisionName))].sort();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <PageHeader
        title="Scores"
        description="Every result for this event. Corrections happen on the floor's Score Keeper screen."
      />
      <ScoresTable rows={scoreRows} wods={wodNames} divisions={divisionNames} />
    </div>
  );
}
