import Link from "next/link";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { updateRegistrationPayment, markPaymentStatus } from "@/lib/actions/payments";
import type { PaymentStatus } from "@/lib/db/database.types";

const STATUS_STYLES: Record<PaymentStatus, string> = {
  unpaid: "bg-black/5 text-black/50",
  paid: "bg-green-100 text-green-700",
  waived: "bg-blue-100 text-blue-700",
  refunded: "bg-amber-100 text-amber-700",
};

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function EventPaymentsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const [
    { data: event },
    { data: divisions },
    { data: feeSchedules },
    { data: registrations },
    { data: paymentAccount },
  ] = await Promise.all([
    supabase.from("events").select("name").eq("id", eventId).maybeSingle(),
    supabase.from("divisions").select("id, name").eq("event_id", eventId).order("sort_order"),
    supabase
      .from("fee_schedules")
      .select("id, name, amount_cents")
      .eq("event_id", eventId)
      .eq("active", true)
      .order("name"),
    supabase
      .from("registrations")
      .select(
        "id, bib_number, division_id, athletes(first_name, last_name), teams(name, entry_format), payments(id, status, payment_method, amount_cents, fee_schedule_id, notes)",
      )
      .eq("event_id", eventId),
    ctx?.organizationId
      ? supabase
          .from("payment_accounts")
          .select("status")
          .eq("organization_id", ctx.organizationId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const typedRegistrations = (registrations ?? []) as unknown as Array<{
    id: string;
    bib_number: string | null;
    division_id: string;
    athletes: { first_name: string; last_name: string } | null;
    teams: { name: string; entry_format: string } | null;
    payments: {
      id: string;
      status: PaymentStatus;
      payment_method: string;
      amount_cents: number;
      fee_schedule_id: string | null;
      notes: string | null;
    } | null;
  }>;

  const divisionName = (id: string) => divisions?.find((d) => d.id === id)?.name ?? "—";
  const accountStatus = paymentAccount?.status ?? "not_connected";

  const totals = typedRegistrations.reduce(
    (acc, r) => {
      const p = r.payments;
      if (p?.status === "paid") acc.collectedCents += p.amount_cents;
      else if (p && p.status !== "waived") acc.outstandingCents += p.amount_cents;
      return acc;
    },
    { collectedCents: 0, outstandingCents: 0 },
  );

  return (
    <div>
      <p className="mb-4 text-sm">
        <Link href={`/admin/events/${eventId}`} className="text-repone-red underline">
          ← {event?.name ?? "Back to Event"}
        </Link>
      </p>
      <h1 className="mb-2 text-2xl font-bold">Payments</h1>

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <span className="font-bold uppercase tracking-wide">
          Online payments: {accountStatus === "connected" ? "Connected" : "Not connected"}
        </span>
        <span>
          This is a manual ledger — organizers record cash/e-transfer/comped payments by hand.
          Stripe is not integrated yet, so no card is ever charged or stored here.
        </span>
      </div>

      <div className="mb-6 flex gap-6 text-sm">
        <p>
          <span className="text-black/50">Collected: </span>
          <span className="font-semibold text-green-700">{formatMoney(totals.collectedCents)}</span>
        </p>
        <p>
          <span className="text-black/50">Outstanding: </span>
          <span className="font-semibold text-repone-red">
            {formatMoney(totals.outstandingCents)}
          </span>
        </p>
      </div>

      {feeSchedules?.length === 0 && (
        <p className="mb-6 text-sm text-black/50">
          No fees defined yet —{" "}
          <Link href={`/admin/events/${eventId}/fees`} className="text-repone-red underline">
            set up a fee schedule
          </Link>{" "}
          first, then come back here to apply it and record payments.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {typedRegistrations.map((r) => {
          const p = r.payments;
          const status: PaymentStatus = p?.status ?? "unpaid";
          const name = r.athletes
            ? `${r.athletes.first_name} ${r.athletes.last_name}`
            : (r.teams?.name ?? "—");
          const kind = r.athletes ? "Individual" : (r.teams?.entry_format ?? "");

          return (
            <div key={r.id} className="rounded-lg border border-black/10 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {name}{" "}
                    <span className="ml-1 rounded-full bg-black/5 px-2 py-0.5 text-xs font-bold uppercase text-black/50">
                      {kind}
                    </span>
                    {r.bib_number ? (
                      <span className="ml-2 text-xs text-black/40">#{r.bib_number}</span>
                    ) : null}
                  </p>
                  <p className="text-xs uppercase tracking-wide text-black/50">
                    {divisionName(r.division_id)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${STATUS_STYLES[status]}`}
                  >
                    {status}
                  </span>
                  {p?.amount_cents ? (
                    <span className="text-sm font-semibold">{formatMoney(p.amount_cents)}</span>
                  ) : null}
                </div>
              </div>

              <div className="mb-3 flex flex-wrap gap-2">
                <form action={markPaymentStatus.bind(null, eventId, r.id, "paid")}>
                  <button className="rounded-md border border-black/20 px-3 py-1.5 text-xs font-semibold uppercase hover:border-green-600 hover:text-green-700">
                    Mark Paid
                  </button>
                </form>
                <form action={markPaymentStatus.bind(null, eventId, r.id, "waived")}>
                  <button className="rounded-md border border-black/20 px-3 py-1.5 text-xs font-semibold uppercase hover:border-blue-600 hover:text-blue-700">
                    Waive
                  </button>
                </form>
                <form action={markPaymentStatus.bind(null, eventId, r.id, "refunded")}>
                  <button className="rounded-md border border-black/20 px-3 py-1.5 text-xs font-semibold uppercase hover:border-amber-600 hover:text-amber-700">
                    Refunded
                  </button>
                </form>
                <form action={markPaymentStatus.bind(null, eventId, r.id, "unpaid")}>
                  <button className="rounded-md border border-black/20 px-3 py-1.5 text-xs font-semibold uppercase text-black/50 hover:border-repone-red hover:text-repone-red">
                    Reset to Unpaid
                  </button>
                </form>
              </div>

              <form
                action={updateRegistrationPayment.bind(null, eventId, r.id)}
                className="flex flex-wrap items-end gap-3 border-t border-black/5 pt-3 text-sm"
              >
                <label className="flex flex-col gap-1">
                  Apply fee
                  <select
                    name="fee_schedule_id"
                    defaultValue={p?.fee_schedule_id ?? ""}
                    className="rounded-md border border-black/20 px-2 py-1.5"
                  >
                    <option value="">— none —</option>
                    {(feeSchedules ?? []).map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({formatMoney(f.amount_cents)})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  Amount override
                  <input
                    name="amount_dollars"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder={p ? (p.amount_cents / 100).toFixed(2) : "0.00"}
                    className="w-24 rounded-md border border-black/20 px-2 py-1.5"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  Status
                  <select
                    name="status"
                    defaultValue={status}
                    className="rounded-md border border-black/20 px-2 py-1.5"
                  >
                    <option value="unpaid">Unpaid</option>
                    <option value="paid">Paid</option>
                    <option value="waived">Waived</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  Method
                  <select
                    name="payment_method"
                    defaultValue={p?.payment_method ?? "unpaid"}
                    className="rounded-md border border-black/20 px-2 py-1.5"
                  >
                    <option value="unpaid">—</option>
                    <option value="cash">Cash</option>
                    <option value="manual_other">Other (manual)</option>
                    <option value="stripe">Stripe (future)</option>
                  </select>
                </label>
                <label className="flex flex-1 flex-col gap-1">
                  Notes
                  <input
                    name="notes"
                    defaultValue={p?.notes ?? ""}
                    placeholder="e.g. paid cash at check-in"
                    className="rounded-md border border-black/20 px-2 py-1.5"
                  />
                </label>
                <button className="control-btn control-btn-red px-4 py-2 text-sm">Save</button>
              </form>
            </div>
          );
        })}
        {typedRegistrations.length === 0 && (
          <p className="text-black/50">
            No registrations yet —{" "}
            <Link href={`/admin/events/${eventId}/athletes`} className="text-repone-red underline">
              register athletes or teams
            </Link>{" "}
            first.
          </p>
        )}
      </div>
    </div>
  );
}
