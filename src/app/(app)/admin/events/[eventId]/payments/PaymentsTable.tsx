"use client";

import Link from "next/link";
import { BadgeCheck, Wallet } from "lucide-react";
import type { PaymentStatus } from "@/lib/db/database.types";
import { markPaymentStatus } from "@/lib/actions/payments";
import { dataTableColumns } from "@/lib/data-table";
import { formatCents } from "@/lib/money";
import { useServerAction } from "@/lib/use-server-action";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { DataTable } from "@/components/app/data-table/DataTable";
import { EmptyState } from "@/components/app/EmptyState";
import { FormDialog } from "@/components/app/FormDialog";
import { RowActions, useEntityDialogs } from "@/components/app/RowActions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaymentForm } from "./PaymentForm";
import { METHOD_LABEL, STATUS_OPTIONS, STATUS_STYLES } from "./paymentOptions";

export type PaymentRow = {
  /** The registration's id: a payment hangs off it. */
  id: string;
  name: string;
  /** "Individual", or the team's entry format. */
  kind: string;
  divisionId: string;
  divisionName: string;
  bib: string | null;
  status: PaymentStatus;
  amountCents: number | null;
  method: string | null;
  feeId: string | null;
  notes: string | null;
};

type Fee = { id: string; name: string; amountCents: number };

function PaymentActions({ eventId, r, fees }: { eventId: string; r: PaymentRow; fees: Fee[] }) {
  const dialogs = useEntityDialogs<"edit" | "refund" | "reset">();
  const mark = useServerAction(
    (status: PaymentStatus) => markPaymentStatus(eventId, r.id, status),
    {
      success: (_d, status) => (status === "paid" ? "Marked paid" : "Waived"),
    },
  );
  return (
    <>
      <RowActions
        label={`Payment actions for ${r.name}`}
        primary={
          r.status === "paid"
            ? undefined
            : {
                label: "Mark paid",
                icon: BadgeCheck,
                onSelect: () => mark.mutate("paid"),
                disabled: mark.isPending,
              }
        }
        secondary={[
          ...(r.status === "waived"
            ? []
            : [{ label: "Waive", onSelect: () => mark.mutate("waived") }]),
          { label: "Edit payment", onSelect: dialogs.show("edit") },
        ]}
        destructive={[
          ...(r.status === "refunded"
            ? []
            : [{ label: "Mark refunded", onSelect: dialogs.show("refund") }]),
          ...(r.status === "unpaid"
            ? []
            : [{ label: "Reset to unpaid", onSelect: dialogs.show("reset") }]),
        ]}
      />
      <FormDialog
        title={`Payment for ${r.name}`}
        description={r.divisionName}
        {...dialogs.props("edit")}
      >
        {(close) => <PaymentForm eventId={eventId} row={r} fees={fees} close={close} />}
      </FormDialog>
      <ConfirmAction
        {...dialogs.props("refund")}
        title={`Mark ${r.name}'s payment as refunded?`}
        description={`The payment is recorded as refunded${r.amountCents ? ` and ${formatCents(r.amountCents)} leaves the collected total` : ""}. You can change it back later.`}
        confirmLabel="Mark refunded"
        onConfirm={() => markPaymentStatus(eventId, r.id, "refunded")}
      />
      <ConfirmAction
        {...dialogs.props("reset")}
        title={`Reset ${r.name}'s payment to unpaid?`}
        description="The payment goes back to unpaid and counts as outstanding again. You can change it back later."
        confirmLabel="Reset to unpaid"
        onConfirm={() => markPaymentStatus(eventId, r.id, "unpaid")}
      />
    </>
  );
}

export function PaymentsTable({
  eventId,
  rows,
  fees,
  divisions,
}: {
  eventId: string;
  rows: PaymentRow[];
  fees: Fee[];
  divisions: { id: string; name: string }[];
}) {
  const col = dataTableColumns<PaymentRow>();
  const columns = [
    col.accessor((r) => `${r.name} ${r.bib ?? ""} ${r.notes ?? ""}`, {
      id: "competitor",
      header: "Competitor",
      cell: ({ row }) => (
        <span className="flex flex-col">
          <span className="font-semibold">{row.original.name}</span>
          {row.original.bib ? (
            <span className="text-xs text-muted-foreground tabular-nums">#{row.original.bib}</span>
          ) : null}
        </span>
      ),
    }),
    col.accessor("kind", {
      header: "Type",
      enableSorting: false,
      filterFn: (row, _id, value) =>
        value === "individual"
          ? row.original.kind === "Individual"
          : row.original.kind !== "Individual",
      meta: { priority: "low" },
      cell: ({ getValue }) => (
        <Badge variant="secondary" className="uppercase">
          {getValue()}
        </Badge>
      ),
    }),
    col.accessor("divisionId", {
      header: "Division",
      enableSorting: false,
      filterFn: "equals",
      // On a phone the division filter stands in for the column.
      meta: { priority: "low" },
      cell: ({ row }) => row.original.divisionName,
    }),
    col.accessor("status", {
      header: "Status",
      filterFn: "equals",
      cell: ({ getValue }) => (
        <Badge className={`uppercase ${STATUS_STYLES[getValue()]}`}>{getValue()}</Badge>
      ),
    }),
    col.accessor((r) => r.amountCents ?? 0, {
      id: "amount",
      header: "Amount",
      cell: ({ row }) =>
        row.original.amountCents ? (
          <span className="tabular-nums">{formatCents(row.original.amountCents)}</span>
        ) : (
          "—"
        ),
    }),
    col.accessor((r) => r.method ?? "", {
      id: "method",
      header: "Method",
      enableSorting: false,
      meta: { priority: "low" },
      cell: ({ getValue }) => (getValue() ? (METHOD_LABEL[getValue()] ?? getValue()) : "—"),
    }),
    col.accessor((r) => r.notes ?? "", {
      id: "notes",
      header: "Notes",
      enableSorting: false,
      meta: { priority: "low", className: "max-w-48" },
      cell: ({ getValue }) =>
        getValue() ? (
          <span className="line-clamp-2" title={getValue()}>
            {getValue()}
          </span>
        ) : (
          "—"
        ),
    }),
    col.display({
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      meta: { rowActions: true },
      cell: ({ row }) => <PaymentActions eventId={eventId} r={row.original} fees={fees} />,
    }),
  ];
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      search={{ label: "Search payments", placeholder: "Search by name, bib or note…" }}
      filters={[
        { columnId: "status", label: "Status", allLabel: "All statuses", options: STATUS_OPTIONS },
        {
          columnId: "divisionId",
          label: "Division",
          allLabel: "All divisions",
          options: divisions.map((d) => [d.id, d.name] as const),
        },
        {
          columnId: "kind",
          label: "Type",
          allLabel: "Individuals and teams",
          options: [
            ["individual", "Individuals"],
            ["team", "Pairs, teams and custom"],
          ],
        },
      ]}
      empty={
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
      }
    />
  );
}
