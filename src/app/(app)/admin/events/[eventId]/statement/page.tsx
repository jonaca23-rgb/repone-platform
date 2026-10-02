import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { createExpense, deleteExpense } from "@/lib/actions/expenses";
import type { ExpenseCategory } from "@/lib/db/database.types";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { PageHeader } from "@/components/app/PageHeader";
import { AdminBreadcrumb, eventCrumbs } from "@/components/shells/AdminBreadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAdminEvent, requireAdminEvent } from "../adminEvent";

type Props = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await getAdminEvent((await params).eventId);
  return { title: event ? `Statement · ${event.name}` : "Statement" };
}

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  venue: "Venue",
  equipment: "Equipment",
  staff_judges: "Judges / Staff",
  prizes: "Prizes",
  marketing: "Marketing",
  other: "Other",
};
const CATEGORY_ORDER: ExpenseCategory[] = [
  "venue",
  "equipment",
  "staff_judges",
  "prizes",
  "marketing",
  "other",
];

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
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Income & expense statement"
        breadcrumb={<AdminBreadcrumb items={eventCrumbs(event, { label: "Statement" })} />}
      />
      <p className="-mt-3 max-w-prose text-muted-foreground">
        Income is competition-fee money actually collected (registrations marked Paid on{" "}
        <Link href={`/admin/events/${eventId}/payments`} className="text-brand-text underline">
          Payments
        </Link>
        ); a waived or unpaid fee counts as $0 here. Expenses are entered by hand below. This is a
        manual bookkeeping tool, not a bank or accounting-software connection.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card size="sm">
          <CardContent>
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Income collected
            </p>
            <p className="mt-1 font-display text-3xl font-bold tabular-nums text-success-text">
              {formatMoney(incomeCents)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {paidRegistrations.length} paid registration(s)
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Expenses
            </p>
            <p className="mt-1 font-display text-3xl font-bold tabular-nums text-brand-text">
              {formatMoney(expensesCents)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {expenseRows.length} entr{expenseRows.length === 1 ? "y" : "ies"}
            </p>
          </CardContent>
        </Card>
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
              {formatMoney(netCents)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add an expense</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={createExpense.bind(null, eventId)}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="grid gap-2">
              <Label htmlFor="expense-category">Category</Label>
              <Select name="category" defaultValue="other">
                <SelectTrigger id="expense-category" className="min-w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_ORDER.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid min-w-48 flex-1 gap-2">
              <Label htmlFor="expense-description">Description</Label>
              <Input
                id="expense-description"
                name="description"
                required
                placeholder="e.g. Venue rental deposit"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="expense-amount">Amount (USD)</Label>
              <Input
                id="expense-amount"
                name="amount_dollars"
                type="number"
                min={0}
                step="0.01"
                required
                placeholder="250.00"
                className="w-28"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="expense-date">Date incurred</Label>
              <Input id="expense-date" type="date" name="incurred_on" />
            </div>
            <div className="grid min-w-48 flex-1 gap-2">
              <Label htmlFor="expense-notes">Notes</Label>
              <Input id="expense-notes" name="notes" placeholder="Optional" />
            </div>
            <Button type="submit">Add expense</Button>
          </form>
        </CardContent>
      </Card>

      {byCategory.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>By category</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((c) => (
              <Badge key={c} variant="secondary">
                {CATEGORY_LABELS[c]}: {formatMoney(byCategory.get(c) ?? 0)}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Expense log</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {expenseRows.map((e) => (
            <div
              key={e.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-3"
            >
              <div>
                <p className="font-semibold">
                  {e.description}{" "}
                  <span className="ml-2 text-brand-text">{formatMoney(e.amount_cents)}</span>
                </p>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {CATEGORY_LABELS[e.category as ExpenseCategory]}
                  {e.incurred_on ? ` · ${e.incurred_on}` : ""}
                </p>
                {e.notes ? <p className="mt-1 text-sm text-muted-foreground">{e.notes}</p> : null}
              </div>
              <ConfirmAction
                trigger="Remove"
                title={`Remove ${e.description}?`}
                description={`The ${formatMoney(e.amount_cents)} expense is deleted and the statement totals update.`}
                confirmLabel="Remove expense"
                onConfirm={deleteExpense.bind(null, eventId, e.id)}
              />
            </div>
          ))}
          {expenseRows.length === 0 && (
            <p className="text-muted-foreground">No expenses logged yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
