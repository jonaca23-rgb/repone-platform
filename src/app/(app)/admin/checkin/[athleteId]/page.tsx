import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getSessionContext } from "@/lib/auth/session";
import { markPaymentStatusForCheckin } from "@/lib/actions/payments";
import type { PaymentStatus } from "@/lib/db/database.types";

// Registration desk screen: scan the athlete's QR code (from their profile)
// or find them from the /admin/checkin picker, and this shows one big
// green/red banner per event they're registered for so a volunteer with no
// payments-module training can tell at a glance whether to let them compete.
// "Good to go" = paid or waived; anything else (including no payment row at
// all yet) reads as missing, matching the spec: manual entry now, with the
// existing Payments module (0007_payments_and_teams.sql) as the real ledger.
const GOOD_STATUSES = new Set<PaymentStatus>(["paid", "waived"]);

type RegistrationRow = {
  id: string;
  event_id: string;
  bib_number: string | null;
  events: { name: string; status: string } | null;
  divisions: { name: string } | null;
  payments: { status: PaymentStatus; amount_cents: number; payment_method: string } | null;
};

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function AthleteCheckInPage({ params }: { params: Promise<{ athleteId: string }> }) {
  const { athleteId } = await params;
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data: athlete } = await supabase
    .from("athletes")
    .select("id, first_name, last_name, affiliate, photo_url")
    .eq("id", athleteId)
    .eq("organization_id", ctx?.organizationId ?? "")
    .maybeSingle();
  if (!athlete) notFound();

  const { data: registrations } = await supabase
    .from("registrations")
    .select("id, event_id, bib_number, events(name, status), divisions(name), payments(status, amount_cents, payment_method)")
    .eq("athlete_id", athleteId);

  const typedRegistrations = (registrations ?? []) as unknown as RegistrationRow[];

  return (
    <div className="max-w-2xl">
      <p className="mb-4 text-sm">
        <Link href={`/admin/athletes/${athleteId}`} className="text-repone-red underline">
          ← {athlete.first_name} {athlete.last_name}&apos;s profile
        </Link>
      </p>

      <div className="mb-6 flex items-center gap-4">
        {athlete.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, not a local/optimizable asset
          <img
            src={athlete.photo_url}
            alt={`${athlete.first_name} ${athlete.last_name}`}
            className="h-16 w-16 rounded-full border border-black/10 object-cover object-top"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-black/10 bg-black/5 text-xs text-black/40">
            No photo
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold">
            {athlete.first_name} {athlete.last_name}
          </h1>
          {athlete.affiliate && <p className="text-sm text-black/50">{athlete.affiliate}</p>}
        </div>
      </div>

      {typedRegistrations.length === 0 && (
        <p className="rounded-lg border border-black/10 p-4 text-black/50">
          No event registrations found for this athlete yet —{" "}
          <Link href="/admin/athletes" className="text-repone-red underline">
            register them into a division from an event&apos;s Athletes page
          </Link>{" "}
          first.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {typedRegistrations.map((r) => {
          const status: PaymentStatus = r.payments?.status ?? "unpaid";
          const goodToGo = GOOD_STATUSES.has(status);

          return (
            <div key={r.id} className="overflow-hidden rounded-xl border-2 border-black/10">
              <div
                className={`p-6 text-center ${goodToGo ? "bg-green-50 text-green-700" : "bg-red-50 text-repone-red"}`}
              >
                <p className="text-3xl font-black uppercase tracking-wide">
                  {goodToGo ? "✓ Good to Go" : "✗ Payment Missing"}
                </p>
                <p className="mt-1 text-sm font-semibold uppercase tracking-wide opacity-80">
                  {r.events?.name ?? "Event"} — {r.divisions?.name ?? "—"}
                  {r.bib_number ? ` — Bib #${r.bib_number}` : ""}
                </p>
                {r.payments?.amount_cents ? (
                  <p className="mt-1 text-xs opacity-70">
                    {formatMoney(r.payments.amount_cents)} · {status}
                  </p>
                ) : (
                  <p className="mt-1 text-xs opacity-70 uppercase tracking-wide">{status}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2 border-t border-black/10 bg-white p-3">
                <form action={markPaymentStatusForCheckin.bind(null, athleteId, r.event_id, r.id, "paid")}>
                  <button className="rounded-md border border-black/20 px-3 py-1.5 text-xs font-semibold uppercase hover:border-green-600 hover:text-green-700">
                    Mark Paid
                  </button>
                </form>
                <form action={markPaymentStatusForCheckin.bind(null, athleteId, r.event_id, r.id, "waived")}>
                  <button className="rounded-md border border-black/20 px-3 py-1.5 text-xs font-semibold uppercase hover:border-blue-600 hover:text-blue-700">
                    Waive
                  </button>
                </form>
                <form action={markPaymentStatusForCheckin.bind(null, athleteId, r.event_id, r.id, "unpaid")}>
                  <button className="rounded-md border border-black/20 px-3 py-1.5 text-xs font-semibold uppercase text-black/50 hover:border-repone-red hover:text-repone-red">
                    Reset to Unpaid
                  </button>
                </form>
                <Link
                  href={`/admin/events/${r.event_id}/payments`}
                  className="ml-auto self-center text-xs text-black/40 underline hover:text-repone-red"
                >
                  Full Payments page →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
