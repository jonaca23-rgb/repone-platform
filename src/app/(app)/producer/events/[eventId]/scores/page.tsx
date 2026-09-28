import Link from "next/link";
import { createClient } from "@/lib/db/server";

// Read-only score status across the whole event — "Official/unofficial
// score status" + a way in to "Score corrections" per spec. Producer RLS
// (0024_event_role_assignments.sql) already permits writing results for an
// assigned event, so corrections happen on the existing Score Keeper screen
// for the relevant floor rather than a second results-entry UI here.
export default async function ProducerEventScoresPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await createClient();

  const { data: heats } = await supabase
    .from("heats")
    .select("id, floor_id, heat_number, wods(name), divisions(name)")
    .eq("event_id", eventId);

  type HeatRow = { id: string; floor_id: string; heat_number: number; wods: { name: string } | null; divisions: { name: string } | null };
  const heatRows = (heats ?? []) as unknown as HeatRow[];
  const heatIds = heatRows.map((h) => h.id);
  const heatById = new Map(heatRows.map((h) => [h.id, h]));

  const { data: results } = heatIds.length
    ? await supabase
        .from("results")
        .select("id, heat_id, status, manually_adjusted, athletes(first_name, last_name), teams(name)")
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
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="flex flex-col gap-1.5">
        {resultRows.map((r) => {
          const heat = heatById.get(r.heat_id);
          const name = r.athletes ? `${r.athletes.first_name} ${r.athletes.last_name}` : r.teams?.name ?? "—";
          return (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-repone-gray px-4 py-2.5">
              <div>
                <span className="font-semibold text-white">{name}</span>
                <span className="ml-2 text-sm text-white/50">
                  {heat?.wods?.name} · Heat {heat?.heat_number} ({heat?.divisions?.name})
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide">
                {r.manually_adjusted && <span className="rounded-full bg-black/40 px-2 py-0.5 text-white/60">Adjusted</span>}
                <span
                  className={`rounded-full px-2 py-0.5 font-bold ${
                    r.status === "completed" ? "bg-green-500/20 text-green-400" : "bg-repone-red/20 text-repone-red"
                  }`}
                >
                  {r.status}
                </span>
                {heat && (
                  <Link href={`/scorekeeper/${heat.floor_id}`} className="text-repone-red underline">
                    Correct →
                  </Link>
                )}
              </div>
            </div>
          );
        })}
        {resultRows.length === 0 && <p className="text-white/50">No scores recorded for this event yet.</p>}
      </div>
    </div>
  );
}
