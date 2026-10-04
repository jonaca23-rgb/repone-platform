import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, CircleX } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getSessionContext } from "@/lib/auth/session";
import type { PaymentStatus } from "@/lib/db/database.types";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { AdminBreadcrumb } from "@/components/shells/AdminBreadcrumb";
import { Button } from "@/components/ui/button";
import { CheckinActions } from "./CheckinActions";
import { formatCents } from "@/lib/money";

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

type Props = { params: Promise<{ athleteId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { athleteId } = await params;
  const ctx = await getSessionContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("athletes")
    .select("first_name, last_name")
    .eq("id", athleteId)
    .eq("organization_id", ctx?.organizationId ?? "")
    .maybeSingle();
  return { title: data ? `Check-In · ${data.first_name} ${data.last_name}` : "Check-In" };
}

export default async function AthleteCheckInPage({ params }: Props) {
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
    .select(
      "id, event_id, bib_number, events(name, status), divisions(name), payments(status, amount_cents, payment_method)",
    )
    .eq("athlete_id", athleteId);

  const typedRegistrations = (registrations ?? []) as unknown as RegistrationRow[];

  const name = `${athlete.first_name} ${athlete.last_name}`;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={name}
        description={athlete.affiliate ?? undefined}
        breadcrumb={
          <AdminBreadcrumb
            items={[
              { label: "Check-In", href: "/admin/checkin" },
              { label: name, href: `/admin/athletes/${athleteId}` },
              { label: "Status" },
            ]}
          />
        }
      />

      <div className="flex items-center gap-4">
        {athlete.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, not a local/optimizable asset
          <img
            src={athlete.photo_url}
            alt={name}
            className="h-16 w-16 rounded-full border border-border object-cover object-top"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-muted text-xs text-muted-foreground">
            No photo
          </div>
        )}
        <Link
          href={`/admin/athletes/${athleteId}`}
          className="text-sm font-semibold text-brand-text underline"
        >
          Open {athlete.first_name}&apos;s profile
        </Link>
      </div>

      {typedRegistrations.length === 0 && (
        <EmptyState
          title="No event registrations yet"
          description="Register this athlete into a division from an event's Athletes page first."
          action={
            <Button asChild variant="outline">
              <Link href="/admin">Go to Events</Link>
            </Button>
          }
        />
      )}

      <div className="flex flex-col gap-4">
        {typedRegistrations.map((r) => {
          const status: PaymentStatus = r.payments?.status ?? "unpaid";
          const goodToGo = GOOD_STATUSES.has(status);
          const StatusIcon = goodToGo ? CircleCheck : CircleX;

          return (
            <div key={r.id} className="overflow-hidden rounded-xl border-2 border-border bg-card">
              <div
                className={`p-6 text-center ${goodToGo ? "bg-success/10 text-success-text" : "bg-destructive/10 text-destructive"}`}
              >
                <p className="flex items-center justify-center gap-2 font-display text-4xl font-bold uppercase tracking-wide">
                  <StatusIcon aria-hidden className="size-8" />
                  {goodToGo ? "Good to go" : "Payment missing"}
                </p>
                <p className="mt-1 text-sm font-semibold uppercase tracking-wide">
                  {r.events?.name ?? "Event"} — {r.divisions?.name ?? "—"}
                  {r.bib_number ? ` — Bib #${r.bib_number}` : ""}
                </p>
                {r.payments?.amount_cents ? (
                  <p className="mt-1 text-xs">
                    {formatCents(r.payments.amount_cents)} · {status}
                  </p>
                ) : (
                  <p className="mt-1 text-xs uppercase tracking-wide">{status}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-border p-3">
                <CheckinActions
                  athleteId={athleteId}
                  eventId={r.event_id}
                  registrationId={r.id}
                  athleteName={name}
                  eventName={r.events?.name ?? "this event"}
                />
                <Link
                  href={`/admin/events/${r.event_id}/payments`}
                  className="ml-auto text-sm text-muted-foreground underline hover:text-brand-text"
                >
                  Full Payments page
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
