import type { Metadata } from "next";
import Link from "next/link";
import { Info, Wallet } from "lucide-react";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { updateRegistrationPayment, markPaymentStatus } from "@/lib/actions/payments";
import type { PaymentStatus } from "@/lib/db/database.types";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { AdminBreadcrumb, eventCrumbs } from "@/components/shells/AdminBreadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NONE } from "@/lib/validation/none";
import { getAdminEvent, requireAdminEvent } from "../adminEvent";

const STATUS_STYLES: Record<PaymentStatus, string> = {
  unpaid: "border-warning/40 bg-warning/10 text-warning-text",
  paid: "border-success/40 bg-success/10 text-success-text",
  waived: "border-border bg-secondary text-secondary-foreground",
  refunded: "border-destructive/40 bg-destructive/10 text-destructive",
};

type Props = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await getAdminEvent((await params).eventId);
  return { title: event ? `Payments · ${event.name}` : "Payments" };
}

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
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
        <Card size="sm">
          <CardContent>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Collected
            </p>
            <p className="font-display text-3xl font-bold tabular-nums text-success-text">
              {formatMoney(totals.collectedCents)}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Outstanding
            </p>
            <p className="font-display text-3xl font-bold tabular-nums text-warning-text">
              {formatMoney(totals.outstandingCents)}
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

      {typedRegistrations.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No registrations yet"
          description="Register athletes or teams first; their payments show up here."
          action={
            <Button asChild variant="outline">
              <Link href={`/admin/events/${eventId}/athletes`}>Go to Athletes</Link>
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {typedRegistrations.map((r) => {
            const p = r.payments;
            const status: PaymentStatus = p?.status ?? "unpaid";
            const name = r.athletes
              ? `${r.athletes.first_name} ${r.athletes.last_name}`
              : (r.teams?.name ?? "—");
            const kind = r.athletes ? "Individual" : (r.teams?.entry_format ?? "");
            const fid = (field: string) => `pay-${r.id}-${field}`;

            return (
              <Card key={r.id} size="sm">
                <CardContent className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="flex flex-wrap items-center gap-2 font-semibold">
                        {name}
                        <Badge variant="secondary" className="uppercase">
                          {kind}
                        </Badge>
                        {r.bib_number ? (
                          <span className="text-xs text-muted-foreground">#{r.bib_number}</span>
                        ) : null}
                      </p>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {divisionName(r.division_id)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`uppercase ${STATUS_STYLES[status]}`}>{status}</Badge>
                      {p?.amount_cents ? (
                        <span className="text-sm font-semibold tabular-nums">
                          {formatMoney(p.amount_cents)}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <form action={markPaymentStatus.bind(null, eventId, r.id, "paid")}>
                      <Button type="submit" size="sm" variant="outline">
                        Mark paid
                      </Button>
                    </form>
                    <form action={markPaymentStatus.bind(null, eventId, r.id, "waived")}>
                      <Button type="submit" size="sm" variant="outline">
                        Waive
                      </Button>
                    </form>
                    <ConfirmAction
                      trigger="Refunded"
                      triggerVariant="outline"
                      title={`Mark ${name}'s payment as refunded?`}
                      description={`The payment is recorded as refunded${p?.amount_cents ? ` and ${formatMoney(p.amount_cents)} leaves the collected total` : ""}. You can change it back later.`}
                      confirmLabel="Mark refunded"
                      onConfirm={markPaymentStatus.bind(null, eventId, r.id, "refunded")}
                    />
                    <ConfirmAction
                      trigger="Reset to unpaid"
                      triggerVariant="outline"
                      title={`Reset ${name}'s payment to unpaid?`}
                      description="The payment goes back to unpaid and counts as outstanding again. You can change it back later."
                      confirmLabel="Reset to unpaid"
                      onConfirm={markPaymentStatus.bind(null, eventId, r.id, "unpaid")}
                    />
                  </div>

                  <form
                    action={updateRegistrationPayment.bind(null, eventId, r.id)}
                    className="flex flex-wrap items-end gap-3 border-t border-border pt-3"
                  >
                    <div className="grid gap-2">
                      <Label htmlFor={fid("fee")}>Apply fee</Label>
                      <Select name="fee_schedule_id" defaultValue={p?.fee_schedule_id ?? NONE}>
                        <SelectTrigger id={fid("fee")} className="min-w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>None</SelectItem>
                          {(feeSchedules ?? []).map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.name} ({formatMoney(f.amount_cents)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={fid("amount")}>Amount override</Label>
                      <Input
                        id={fid("amount")}
                        name="amount_dollars"
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder={p ? (p.amount_cents / 100).toFixed(2) : "0.00"}
                        className="w-28"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={fid("status")}>Status</Label>
                      <Select name="status" defaultValue={status}>
                        <SelectTrigger id={fid("status")} className="min-w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unpaid">Unpaid</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="waived">Waived</SelectItem>
                          <SelectItem value="refunded">Refunded</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={fid("method")}>Method</Label>
                      <Select name="payment_method" defaultValue={p?.payment_method ?? "unpaid"}>
                        <SelectTrigger id={fid("method")} className="min-w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unpaid">Not set</SelectItem>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="manual_other">Other (manual)</SelectItem>
                          <SelectItem value="stripe">Stripe (future)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid min-w-48 flex-1 gap-2">
                      <Label htmlFor={fid("notes")}>Notes</Label>
                      <Input
                        id={fid("notes")}
                        name="notes"
                        defaultValue={p?.notes ?? ""}
                        placeholder="e.g. paid cash at check-in"
                      />
                    </div>
                    <Button type="submit">Save</Button>
                  </form>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
