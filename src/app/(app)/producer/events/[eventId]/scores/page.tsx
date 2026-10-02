import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { createClient } from "@/lib/db/server";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { Badge } from "@/components/ui/badge";
import { producerEventTitle } from "../producerEvent";

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
    .select("id, floor_id, heat_number, wods(name), divisions(name)")
    .eq("event_id", eventId);

  type HeatRow = {
    id: string;
    floor_id: string;
    heat_number: number;
    wods: { name: string } | null;
    divisions: { name: string } | null;
  };
  const heatRows = (heats ?? []) as unknown as HeatRow[];
  const heatIds = heatRows.map((h) => h.id);
  const heatById = new Map(heatRows.map((h) => [h.id, h]));

  const { data: results } = heatIds.length
    ? await supabase
        .from("results")
        .select(
          "id, heat_id, status, manually_adjusted, athletes(first_name, last_name), teams(name)",
        )
        .in("heat_id", heatIds)
    : { data: [] as Array<Record<string, unknown>> };

  type ResultRow = {
    id: string;
    heat_id: string;
    status: string;
    manually_adjusted: boolean;
    athletes: { first_name: string; last_name: string } | null;
    teams: { name: string } | null;
  };
  const resultRows = ((results ?? []) as unknown as ResultRow[]).sort((a, b) => {
    const ha = heatById.get(a.heat_id);
    const hb = heatById.get(b.heat_id);
    return (ha?.heat_number ?? 0) - (hb?.heat_number ?? 0);
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <PageHeader
        title="Scores"
        description="Every result for this event. Corrections happen on the floor's Score Keeper screen."
      />
      {resultRows.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {resultRows.map((r) => {
            const heat = heatById.get(r.heat_id);
            const name = r.athletes
              ? `${r.athletes.first_name} ${r.athletes.last_name}`
              : (r.teams?.name ?? "—");
            return (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-2"
              >
                <div>
                  <span className="font-semibold">{name}</span>
                  <span className="ml-2 text-sm text-muted-foreground">
                    {heat?.wods?.name} · Heat {heat?.heat_number} ({heat?.divisions?.name})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {r.manually_adjusted && <Badge variant="secondary">Adjusted</Badge>}
                  <Badge
                    variant="outline"
                    className={
                      r.status === "completed"
                        ? "border-success/40 bg-success/10 text-success-text"
                        : "border-warning/40 bg-warning/10 text-warning-text"
                    }
                  >
                    {r.status}
                  </Badge>
                  {heat && (
                    <Link
                      href={`/scorekeeper/${heat.floor_id}`}
                      className="inline-flex min-h-11 items-center gap-1 rounded-sm px-2 text-sm font-medium text-brand-text underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
                    >
                      Correct
                      <span className="sr-only"> {name}</span>
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={ClipboardList} title="No scores recorded for this event yet" />
      )}
    </div>
  );
}
