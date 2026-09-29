import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { createFeeSchedule, toggleFeeScheduleActive, deleteFeeSchedule } from "@/lib/actions/fees";
import type { CompetitorEntryType } from "@/lib/db/database.types";

const ENTRY_TYPE_LABELS: Record<CompetitorEntryType, string> = {
  individual: "Individual",
  pair: "Pair",
  team: "Team",
  custom: "Custom format",
};

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function EventFeesPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await createClient();

  const [{ data: event }, { data: divisions }, { data: feeSchedules }] = await Promise.all([
    supabase.from("events").select("name").eq("id", eventId).maybeSingle(),
    supabase.from("divisions").select("id, name").eq("event_id", eventId).order("sort_order"),
    supabase
      .from("fee_schedules")
      .select("id, name, description, division_id, entry_type, amount_cents, is_addon, active")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false }),
  ]);

  const divisionName = (id: string | null) =>
    id ? divisions?.find((d) => d.id === id)?.name : null;

  return (
    <div>
      <p className="mb-4 text-sm">
        <Link href={`/admin/events/${eventId}`} className="text-repone-red underline">
          ← {event?.name ?? "Back to Event"}
        </Link>
      </p>
      <h1 className="mb-2 text-2xl font-bold">Registration Fees</h1>
      <p className="mb-6 max-w-3xl text-sm text-black/50">
        Define what this event charges — this is the price menu the Payments page uses to record who
        owes what. <strong>No online payment is taken here.</strong> Nothing on this page talks to
        Stripe or any payment processor; fees are recorded manually until online checkout is built.
        Leave Division or Entry Type blank to apply a fee broadly (e.g. blank entry type = charges
        the same amount whether it&apos;s an individual, pair, team, or custom entry).
      </p>

      <form
        action={createFeeSchedule.bind(null, eventId)}
        className="mb-8 flex flex-wrap items-end gap-3 rounded-lg border border-black/10 p-4"
      >
        <label className="flex flex-col gap-1 text-sm">
          Fee name
          <input
            name="name"
            required
            placeholder="Individual Registration"
            className="rounded-md border border-black/20 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Amount (USD)
          <input
            name="amount_dollars"
            type="number"
            min={0}
            step="0.01"
            required
            placeholder="75.00"
            className="w-28 rounded-md border border-black/20 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Division
          <select
            name="division_id"
            defaultValue=""
            className="rounded-md border border-black/20 px-3 py-2"
          >
            <option value="">— any division —</option>
            {(divisions ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Entry type
          <select
            name="entry_type"
            defaultValue=""
            className="rounded-md border border-black/20 px-3 py-2"
          >
            <option value="">— any entry type —</option>
            {Object.entries(ENTRY_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Description
          <input
            name="description"
            placeholder="Optional"
            className="rounded-md border border-black/20 px-3 py-2"
          />
        </label>
        <label className="flex items-center gap-2 self-end text-sm">
          <input name="is_addon" type="checkbox" />
          Optional add-on (not a base registration fee)
        </label>
        <button className="control-btn control-btn-red px-6 py-3 text-base">Add Fee</button>
      </form>

      <div className="flex flex-col gap-2">
        {(feeSchedules ?? []).map((f) => (
          <div
            key={f.id}
            className="flex items-center justify-between rounded-lg border border-black/10 px-4 py-3"
          >
            <div>
              <p className="font-semibold">
                {f.name} <span className="ml-2 text-repone-red">{formatMoney(f.amount_cents)}</span>
                {f.is_addon ? (
                  <span className="ml-2 rounded-full bg-black/5 px-2 py-0.5 text-xs font-bold uppercase text-black/50">
                    Add-on
                  </span>
                ) : null}
              </p>
              <p className="text-xs uppercase tracking-wide text-black/50">
                {divisionName(f.division_id) ?? "Any division"} ·{" "}
                {f.entry_type
                  ? ENTRY_TYPE_LABELS[f.entry_type as CompetitorEntryType]
                  : "Any entry type"}
              </p>
              {f.description ? <p className="mt-1 text-sm text-black/50">{f.description}</p> : null}
            </div>
            <div className="flex items-center gap-3">
              <form action={toggleFeeScheduleActive.bind(null, eventId, f.id, !f.active)}>
                <button
                  className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                    f.active ? "bg-black/5 text-black/60" : "bg-repone-red/10 text-repone-red"
                  }`}
                >
                  {f.active ? "Active" : "Inactive"}
                </button>
              </form>
              <form action={deleteFeeSchedule.bind(null, eventId, f.id)}>
                <button className="text-sm text-black/40 hover:text-repone-red">Delete</button>
              </form>
            </div>
          </div>
        ))}
        {feeSchedules?.length === 0 && (
          <p className="text-black/50">
            No fees set up yet — add one above, then apply it to registrations from{" "}
            <Link href={`/admin/events/${eventId}/payments`} className="text-repone-red underline">
              Payments
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}
