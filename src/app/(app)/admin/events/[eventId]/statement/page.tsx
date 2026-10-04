import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/db/server";
import type { ExpenseCategory } from "@/lib/db/database.types";
import { PageHeader } from "@/components/app/PageHeader";
import { AdminBreadcrumb, eventCrumbs } from "@/components/shells/AdminBreadcrumb";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import { getAdminEvent, requireAdminEvent } from "../adminEvent";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "./categories";
import { ExpensesTable } from "./ExpensesTable";

type Props = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await getAdminEvent((await params).eventId);
  return { title: event ? `Statement · ${event.name}` : "Statement" };
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
export default async function EventStatementPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();

  const [event, { data: registrations }, { data: expenses }] = await Promise.all([
    requireAdminEvent(eventId),
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
  const incomeCents = paidRegistrations.reduce(
    (sum, r) => sum + (r.payments?.amount_cents ?? 0),
    0,
  );

  const expenseRows = expenses ?? [];
  const expensesCents = expenseRows.reduce((sum, e) => sum + e.amount_cents, 0);
  const byCategory = new Map<ExpenseCategory, number>();
  for (const e of expenseRows) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount_cents);
  }

  const netCents = incomeCents - expensesCents;
  const isProfit = netCents >= 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Income & expense statement"
        breadcrumb={<AdminBreadcrumb items={eventCrumbs(event, { label: "Statement" })} />}
      />
      <p className="-mt-3 max-w-prose text-muted-foreground">
        Income is competition-fee money actually collected (registrations marked Paid on{" "}
        <Link href={`/admin/events/${eventId}/payments`} className="text-brand-text underline">
          Payments
        </Link>
        ); a waived or unpaid fee counts as $0 here. Expenses are logged by hand in the table below.
        This is a manual bookkeeping tool, not a bank or accounting-software connection.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* ui-guard-ignore: statement summary, not a list */}
        <Card size="sm">
          <CardContent>
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Income collected
            </p>
            <p className="mt-1 font-display text-3xl font-bold tabular-nums text-success-text">
              {formatCents(incomeCents)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {paidRegistrations.length} paid registration(s)
            </p>
          </CardContent>
        </Card>
        {/* ui-guard-ignore: statement summary, not a list */}
        <Card size="sm">
          <CardContent>
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Expenses
            </p>
            <p className="mt-1 font-display text-3xl font-bold tabular-nums text-brand-text">
              {formatCents(expensesCents)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {expenseRows.length} entr{expenseRows.length === 1 ? "y" : "ies"}
            </p>
          </CardContent>
        </Card>
        {/* ui-guard-ignore: statement summary, not a list */}
        <Card
          size="sm"
          className={
            isProfit ? "bg-success/10 ring-success/60" : "bg-destructive/10 ring-destructive/60"
          }
        >
          <CardContent>
            <p
              className={`text-xs font-bold uppercase tracking-wide ${isProfit ? "text-success-text" : "text-destructive"}`}
            >
              {isProfit ? "Net profit" : "Net loss"}
            </p>
            <p
              className={`mt-1 font-display text-3xl font-bold tabular-nums ${isProfit ? "text-success-text" : "text-destructive"}`}
            >
              {formatCents(netCents)}
            </p>
          </CardContent>
        </Card>
      </div>

      {byCategory.size > 0 && (
        // ui-guard-ignore: by-category summary, not a list
        <Card>
          <CardHeader>
            <CardTitle>By category</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((c) => (
              <Badge key={c} variant="secondary">
                {CATEGORY_LABELS[c]}: {formatCents(byCategory.get(c) ?? 0)}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-bold uppercase tracking-wide">Expense log</h2>
        <ExpensesTable
          eventId={eventId}
          rows={expenseRows.map((e) => ({
            id: e.id,
            category: e.category,
            description: e.description,
            amountCents: e.amount_cents,
            incurredOn: e.incurred_on,
            notes: e.notes,
          }))}
        />
      </section>
    </div>
  );
}
