import type { Metadata } from "next";
import Link from "next/link";
import { Info } from "lucide-react";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import type { PaymentStatus } from "@/lib/db/database.types";
import { PageHeader } from "@/components/app/PageHeader";
import { AdminBreadcrumb, eventCrumbs } from "@/components/shells/AdminBreadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import { getAdminEvent, requireAdminEvent } from "../adminEvent";
import { type PaymentRow, PaymentsTable } from "./PaymentsTable";

type Props = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await getAdminEvent((await params).eventId);
  return { title: event ? `Payments · ${event.name}` : "Payments" };
}

export default async function EventPaymentsPage({ params }: Props) {
  const { eventId } = await params;
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const [
    event,
    { data: divisions },
    { data: feeSchedules },
    { data: registrations },
    { data: paymentAccount },
  ] = await Promise.all([
    requireAdminEvent(eventId),
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

  const divisionName = new Map((divisions ?? []).map((d) => [d.id, d.name]));
  const rows: PaymentRow[] = typedRegistrations.map((r) => ({
    id: r.id,
    name: r.athletes ? `${r.athletes.first_name} ${r.athletes.last_name}` : (r.teams?.name ?? "—"),
    kind: r.athletes ? "Individual" : (r.teams?.entry_format ?? ""),
    divisionId: r.division_id,
    divisionName: divisionName.get(r.division_id) ?? "—",
    bib: r.bib_number,
    status: r.payments?.status ?? "unpaid",
    amountCents: r.payments?.amount_cents ?? null,
    method: r.payments?.payment_method ?? null,
    feeId: r.payments?.fee_schedule_id ?? null,
    notes: r.payments?.notes ?? null,
  }));
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
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Payments"
        description="Track who's paid. A manual ledger: no online charges yet."
        breadcrumb={<AdminBreadcrumb items={eventCrumbs(event, { label: "Payments" })} />}
      />

      <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-text" />
        <p>
          <span className="font-bold uppercase tracking-wide text-warning-text">
            Online payments: {accountStatus === "connected" ? "Connected" : "Not connected"}
          </span>{" "}
          This is a manual ledger: organizers record cash, e-transfer and comped payments by hand.
          Stripe is not integrated yet, so no card is ever charged or stored here.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        {/* ui-guard-ignore: payment summary totals, not a list */}
        <Card size="sm">
          <CardContent>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Collected
            </p>
            <p className="font-display text-3xl font-bold tabular-nums text-success-text">
              {formatCents(totals.collectedCents)}
            </p>
          </CardContent>
        </Card>
        {/* ui-guard-ignore: payment summary totals, not a list */}
        <Card size="sm">
          <CardContent>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Outstanding
            </p>
            <p className="font-display text-3xl font-bold tabular-nums text-warning-text">
              {formatCents(totals.outstandingCents)}
            </p>
          </CardContent>
        </Card>
      </div>

      {feeSchedules?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No fees defined yet.{" "}
          <Link href={`/admin/events/${eventId}/fees`} className="text-brand-text underline">
            Set up a fee schedule
          </Link>{" "}
          first, then come back here to apply it and record payments.
        </p>
      )}

      <PaymentsTable
        eventId={eventId}
        rows={rows}
        divisions={divisions ?? []}
        fees={(feeSchedules ?? []).map((f) => ({
          id: f.id,
          name: f.name,
          amountCents: f.amount_cents,
        }))}
      />
    </div>
  );
}
