import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { createExpense, deleteExpense } from "@/lib/actions/expenses";
import type { ExpenseCategory } from "@/lib/db/database.types";

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  venue: "Venue",
  equipment: "Equipment",
  staff_judges: "Judges / Staff",
  prizes: "Prizes",
  marketing: "Marketing",
  other: "Other",
};
const CATEGORY_ORDER: ExpenseCategory[] = ["venue", "equipment", "staff_judges", "prizes", "marketing", "other"];

function formatMoney(cents: number) {
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

/**
 * Income & Expense Statement — contrasts competition-fee income actually
 * collected (the `payments` ledger, status = "paid" only — a fee that's
 * waived or still unpaid contributes $0 here, per Jonathan's call, so this
 * number always matches cash actually in hand) against hand-entered event
 * spending (the new `expenses` table). Scoped per event, same as the
 * existing Fees and Payments pages; an all-events rollup is future work
 * once there's more than one event's data worth comparing (see
 * architecture/build-status.md).
 */
export default async function EventStatementPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await createClient();

  const [{ data: event }, { data: registrations }, { data: expenses }] = await Promise.all([
    supabase.from("events").select("name").eq("id", eventId).maybeSingle(),
    supabase
      .from("registrations")
      .select("id, payments(amount_cents, status)")
      .eq("event_id", eventId),
    supabase
      .from("expenses")
      .select("id, category, description, amount_cents, incurred_on, notes")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false }),
  ]);

  type RegistrationRow = { id: string; payments: { amount_cents: number; status: string } | null };
  const typedRegistrations = (registrations ?? []) as unknown as RegistrationRow[];
  const paidRegistrations = typedRegistrations.filter((r) => r.payments?.status === "paid");
  const incomeCents = paidRegistrations.reduce((sum, r) => sum + (r.payments?.amount_cents ?? 0), 0);

  const expenseRows = expenses ?? [];
  const expensesCents = expenseRows.reduce((sum, e) => sum + e.amount_cents, 0);
  const byCategory = new Map<ExpenseCategory, number>();
  for (const e of expenseRows) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount_cents);
  }

  const netCents = incomeCents - expensesCents;
  const isProfit = netCents >= 0;

  return (
    <div className="max-w-3xl">
      <p className="mb-4 text-sm">
        <Link href={`/admin/events/${eventId}`} className="text-repone-red underline">
          ← {event?.name ?? "Back to Event"}
        </Link>
      </p>
      <h1 className="mb-2 text-2xl font-bold">Income &amp; Expense Statement</h1>
      <p className="mb-6 max-w-2xl text-sm text-black/50">
        Income is competition-fee money actually collected (registrations marked &quot;Paid&quot; on the{" "}
        <Link href={`/admin/events/${eventId}/payments`} className="text-repone-red underline">
          Payments
        </Link>{" "}
        page) — a waived or still-unpaid fee counts as $0 here. Expenses are entered by hand below; this is a
        manual bookkeeping tool, not a bank or accounting-software connection.
      </p>

      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-black/10 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-black/50">Income collected</p>
          <p className="mt-1 text-2xl font-bold text-green-700">{formatMoney(incomeCents)}</p>
          <p className="mt-1 text-xs text-black/40">{paidRegistrations.length} paid registration(s)</p>
        </div>
        <div className="rounded-lg border border-black/10 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-black/50">Expenses</p>
          <p className="mt-1 text-2xl font-bold text-repone-red">{formatMoney(expensesCents)}</p>
          <p className="mt-1 text-xs text-black/40">{expenseRows.length} entr{expenseRows.length === 1 ? "y" : "ies"}</p>
        </div>
        <div className={`rounded-lg border-2 p-4 ${isProfit ? "border-green-600 bg-green-50" : "border-repone-red bg-red-50"}`}>
          <p className={`text-xs font-bold uppercase tracking-wide ${isProfit ? "text-green-700" : "text-repone-red"}`}>
            {isProfit ? "Net Profit" : "Net Loss"}
          </p>
          <p className={`mt-1 text-2xl font-bold ${isProfit ? "text-green-700" : "text-repone-red"}`}>
            {formatMoney(netCents)}
          </p>
        </div>
      </div>

      <section className="mb-8 rounded-lg border border-black/10 p-4">
        <h2 className="mb-3 font-semibold">Add an Expense</h2>
        <form
          action={createExpense.bind(null, eventId)}
          className="flex flex-wrap items-end gap-3"
        >
          <label className="flex flex-col gap-1 text-sm">
            Category
            <select name="category" defaultValue="other" className="rounded-md border border-black/20 px-3 py-2">
              {CATEGORY_ORDER.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Description
            <input
              name="description"
              required
              placeholder="e.g. Venue rental deposit"
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
              placeholder="250.00"
              className="w-28 rounded-md border border-black/20 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Date incurred
            <input type="date" name="incurred_on" className="rounded-md border border-black/20 px-3 py-2" />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Notes
            <input name="notes" placeholder="Optional" className="rounded-md border border-black/20 px-3 py-2" />
          </label>
          <button className="control-btn control-btn-red px-6 py-3 text-base">Add Expense</button>
        </form>
      </section>

      {byCategory.size > 0 && (
        <section className="mb-8 rounded-lg border border-black/10 p-4">
          <h2 className="mb-3 font-semibold">By Category</h2>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((c) => (
              <span key={c} className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-black/70">
                {CATEGORY_LABELS[c]}: {formatMoney(byCategory.get(c) ?? 0)}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-black/10 p-4">
        <h2 className="mb-3 font-semibold">Expense Log</h2>
        <div className="flex flex-col gap-2">
          {expenseRows.map((e) => (
            <div key={e.id} className="flex items-center justify-between rounded-lg border border-black/10 px-4 py-3">
              <div>
                <p className="font-semibold">
                  {e.description} <span className="ml-2 text-repone-red">{formatMoney(e.amount_cents)}</span>
                </p>
                <p className="text-xs uppercase tracking-wide text-black/50">
                  {CATEGORY_LABELS[e.category as ExpenseCategory]}
                  {e.incurred_on ? ` · ${e.incurred_on}` : ""}
                </p>
                {e.notes ? <p className="mt-1 text-sm text-black/50">{e.notes}</p> : null}
              </div>
              <form action={deleteExpense.bind(null, eventId, e.id)}>
                <button className="text-sm text-black/40 hover:text-repone-red">Remove</button>
              </form>
            </div>
          ))}
          {expenseRows.length === 0 && <p className="text-black/50">No expenses logged yet.</p>}
        </div>
      </section>
    </div>
  );
}
