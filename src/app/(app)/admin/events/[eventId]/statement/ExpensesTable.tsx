"use client";

import { Plus, Receipt } from "lucide-react";
import type { ExpenseCategory } from "@/lib/db/database.types";
import { createExpense, deleteExpense } from "@/lib/actions/expenses";
import { dataTableColumns } from "@/lib/data-table";
import { formatCents } from "@/lib/money";
import { formatDay } from "@/lib/time";
import { fieldErrorsOf, useServerAction } from "@/lib/use-server-action";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { DataTable } from "@/components/app/data-table/DataTable";
import { createTableContext } from "@/components/app/data-table/tableContext";
import { EmptyState } from "@/components/app/EmptyState";
import { FormAlert } from "@/components/app/FormAlert";
import { FormDialog } from "@/components/app/FormDialog";
import { FormField } from "@/components/app/FormField";
import { RowActions, useEntityDialogs } from "@/components/app/RowActions";
import { SubmitButton } from "@/components/app/SubmitButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "./categories";

export type ExpenseRow = {
  id: string;
  category: ExpenseCategory;
  description: string;
  amountCents: number;
  incurredOn: string | null;
  notes: string | null;
};

const [StatementProvider, useStatement] = createTableContext<{ eventId: string }>("ExpensesTable");

function ExpenseForm({ eventId, close }: { eventId: string; close: () => void }) {
  const save = useServerAction((fd: FormData) => createExpense(eventId, fd), {
    success: "Expense logged",
    toastErrors: false,
    onSuccess: close,
  });
  const errors = fieldErrorsOf(save.error);
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(new FormData(e.currentTarget));
      }}
    >
      <FormField label="Category" name="category" errors={errors?.category}>
        {({ name, ...c }) => (
          <Select name={name} defaultValue="other">
            <SelectTrigger {...c} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_ORDER.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>
      <FormField label="Description" name="description" errors={errors?.description}>
        {(c) => <Input {...c} required placeholder="e.g. Venue rental deposit" />}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Amount (USD)" name="amount_dollars" errors={errors?.amount_dollars}>
          {(c) => (
            <Input
              {...c}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              required
              placeholder="250.00"
            />
          )}
        </FormField>
        <FormField label="Date incurred" name="incurred_on" errors={errors?.incurred_on}>
          {(c) => <Input {...c} type="date" />}
        </FormField>
      </div>
      <FormField label="Notes" name="notes" errors={errors?.notes}>
        {(c) => <Input {...c} placeholder="Optional" />}
      </FormField>
      <FormAlert error={save.error} />
      <SubmitButton pending={save.isPending} pendingLabel="Logging…">
        Log expense
      </SubmitButton>
    </form>
  );
}

function ExpenseActions({ x }: { x: ExpenseRow }) {
  const { eventId } = useStatement();
  const dialogs = useEntityDialogs<"remove">();
  return (
    <>
      <RowActions
        label={`Actions for ${x.description}`}
        destructive={[{ label: "Remove expense", onSelect: dialogs.show("remove") }]}
      />
      <ConfirmAction
        {...dialogs.props("remove")}
        title={`Remove "${x.description}"?`}
        description={`${formatCents(x.amountCents)} comes off this event's expenses.`}
        confirmLabel="Remove expense"
        onConfirm={() => deleteExpense(eventId, x.id)}
      />
    </>
  );
}

const col = dataTableColumns<ExpenseRow>();
const columns = [
  col.accessor((r) => r.incurredOn ?? "", {
    id: "date",
    header: "Date",
    cell: ({ row }) => (row.original.incurredOn ? formatDay(row.original.incurredOn) : "—"),
  }),
  col.accessor("category", {
    header: "Category",
    filterFn: "equals",
    cell: ({ getValue }) => CATEGORY_LABELS[getValue()],
  }),
  col.accessor("description", {
    header: "Description",
    enableSorting: false,
    cell: ({ getValue }) => <span className="font-semibold">{getValue()}</span>,
  }),
  col.accessor("amountCents", {
    header: "Amount",
    cell: ({ getValue }) => <span className="tabular-nums">{formatCents(getValue())}</span>,
  }),
  col.accessor((r) => r.notes ?? "", {
    id: "notes",
    header: "Notes",
    enableSorting: false,
    meta: { priority: "low" },
    cell: ({ getValue }) => getValue() || "—",
  }),
  col.display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    meta: { rowActions: true },
    cell: ({ row }) => <ExpenseActions x={row.original} />,
  }),
];

export function ExpensesTable({ eventId, rows }: { eventId: string; rows: ExpenseRow[] }) {
  const add = (
    <FormDialog
      title="Log an expense"
      trigger={
        <Button>
          <Plus aria-hidden /> Add expense
        </Button>
      }
    >
      {(close) => <ExpenseForm eventId={eventId} close={close} />}
    </FormDialog>
  );
  return (
    <StatementProvider value={{ eventId }}>
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        search={{ label: "Search expenses", placeholder: "Search expenses…" }}
        filters={[
          {
            columnId: "category",
            label: "Category",
            allLabel: "All categories",
            options: CATEGORY_ORDER.map((c) => [c, CATEGORY_LABELS[c]] as const),
          },
        ]}
        toolbar={add}
        empty={<EmptyState icon={Receipt} title="No expenses logged yet" action={add} />}
      />
    </StatementProvider>
  );
}
