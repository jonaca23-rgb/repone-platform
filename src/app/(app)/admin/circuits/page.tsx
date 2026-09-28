import Link from "next/link";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { createCircuit, deleteCircuit } from "@/lib/actions/circuits";

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

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Circuits</h1>
      <p className="mb-6 text-sm text-black/50">
        A circuit groups several events into one season so a competitor&apos;s placement at each stop
        rolls up into a single cumulative leaderboard. You can also start a circuit right from the
        &quot;New Event&quot; form on the Events page — this page is for managing one directly, or adding an
        already-existing standalone event to it after the fact.
      </p>

      <form
        action={createCircuit}
        className="mb-8 flex flex-wrap items-end gap-3 rounded-lg border border-black/10 p-4"
      >
        <label className="flex flex-col gap-1 text-sm">
          Circuit name
          <input name="name" required placeholder="MSTRS League PR" className="rounded-md border border-black/20 px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Description (optional)
          <input name="description" className="w-64 rounded-md border border-black/20 px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Season starts
          <input name="starts_on" type="date" className="rounded-md border border-black/20 px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Season ends
          <input name="ends_on" type="date" className="rounded-md border border-black/20 px-3 py-2" />
        </label>
        <button className="control-btn control-btn-red px-6 py-3 text-base">Create Circuit</button>
      </form>

      <div className="flex flex-col gap-2">
        {(circuits ?? []).map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-lg border border-black/10 px-4 py-3 hover:border-repone-red"
          >
            <Link href={`/admin/circuits/${c.id}`} className="flex flex-1 items-center gap-3">
              <span className="font-semibold">{c.name}</span>
              <span className="text-xs uppercase tracking-wide text-black/50">
                {countByCircuit.get(c.id) ?? 0} event{(countByCircuit.get(c.id) ?? 0) === 1 ? "" : "s"}
              </span>
              {(c.starts_on || c.ends_on) && (
                <span className="text-xs text-black/40">
                  {c.starts_on ?? "—"} {c.ends_on && c.ends_on !== c.starts_on ? `→ ${c.ends_on}` : ""}
                </span>
              )}
            </Link>
            <form action={deleteCircuit.bind(null, c.id)}>
              <button className="text-sm text-black/40 hover:text-repone-red">Delete circuit</button>
            </form>
          </div>
        ))}
        {circuits?.length === 0 && (
          <p className="text-black/50">No circuits yet — create one above, or start one from the New Event form.</p>
        )}
      </div>
    </div>
  );
}
