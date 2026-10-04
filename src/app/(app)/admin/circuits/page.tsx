import type { Metadata } from "next";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { PageHeader } from "@/components/app/PageHeader";
import { type CircuitRow, CircuitsTable } from "./CircuitsTable";

export const metadata: Metadata = { title: "Circuits" };

export default async function CircuitsPage() {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data: circuits } = await supabase
    .from("circuits")
    .select("id, name, description, starts_on, ends_on")
    .eq("organization_id", ctx?.organizationId ?? "")
    .order("starts_on", { ascending: false, nullsFirst: false });

  const { data: eventCounts } = await supabase
    .from("events")
    .select("circuit_id")
    .eq("organization_id", ctx?.organizationId ?? "")
    .not("circuit_id", "is", null);

  const countByCircuit = new Map<string, number>();
  for (const row of eventCounts ?? []) {
    if (!row.circuit_id) continue;
    countByCircuit.set(row.circuit_id, (countByCircuit.get(row.circuit_id) ?? 0) + 1);
  }

  const rows: CircuitRow[] = (circuits ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    startsOn: c.starts_on,
    endsOn: c.ends_on,
    events: countByCircuit.get(c.id) ?? 0,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Circuits"
        description="A circuit groups several events into one season, so a competitor's placement at each stop rolls up into one cumulative leaderboard. You can also start one from the New event dialog on the Events page."
      />
      <CircuitsTable rows={rows} />
    </div>
  );
}
