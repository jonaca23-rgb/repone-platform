"use client";

import Link from "next/link";
import { Plus, Receipt } from "lucide-react";
import type { CompetitorEntryType } from "@/lib/db/database.types";
import { deleteFeeSchedule, toggleFeeScheduleActive } from "@/lib/actions/fees";
import { dataTableColumns } from "@/lib/data-table";
import { formatCents } from "@/lib/money";
import { ActionSwitch } from "@/components/app/ActionSwitch";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { DataTable } from "@/components/app/data-table/DataTable";
import { createTableContext } from "@/components/app/data-table/tableContext";
import { EmptyState } from "@/components/app/EmptyState";
import { FormDialog } from "@/components/app/FormDialog";
import { RowActions, useEntityDialogs } from "@/components/app/RowActions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ENTRY_TYPE_LABELS, ENTRY_TYPE_OPTIONS } from "./entryTypes";
import { FeeForm } from "./FeeForm";

export type FeeRow = {
  id: string;
  name: string;
  description: string | null;
  amountCents: number;
  divisionId: string | null;
  divisionName: string | null;
  entryType: CompetitorEntryType | null;
  isAddon: boolean;
  active: boolean;
};

function FeeActiveSwitch({ f }: { f: FeeRow }) {
  const { eventId } = useFees();
  return (
    <ActionSwitch
      checked={f.active}
      action={(next) => toggleFeeScheduleActive(eventId, f.id, next)}
      label={`${f.name} active`}
    />
  );
}

function FeeActions({ f }: { f: FeeRow }) {
  const { eventId } = useFees();
  const dialogs = useEntityDialogs<"delete">();
  return (
    <>
      <RowActions
        label={`Actions for ${f.name}`}
        destructive={[{ label: "Delete fee", onSelect: dialogs.show("delete") }]}
      />
      <ConfirmAction
        {...dialogs.props("delete")}
        title={`Delete ${f.name}?`}
        description="The fee comes off this event's price menu. Payments already recorded keep their amounts."
        confirmLabel="Delete fee"
        onConfirm={() => deleteFeeSchedule(eventId, f.id)}
      />
    </>
  );
}

const [FeesProvider, useFees] = createTableContext<{ eventId: string }>("FeesTable");

const col = dataTableColumns<FeeRow>();
const columns = [
  col.accessor("name", {
    header: "Fee",
    cell: ({ row }) => (
      <span className="flex flex-wrap items-center gap-2 font-semibold">
        {row.original.name}
        {row.original.isAddon ? <Badge variant="outline">Add-on</Badge> : null}
      </span>
    ),
  }),
  col.accessor("amountCents", {
    header: "Amount",
    cell: ({ getValue }) => <span className="tabular-nums">{formatCents(getValue())}</span>,
  }),
  col.accessor((r) => r.divisionId ?? "any", {
    id: "division",
    header: "Division",
    filterFn: "equals",
    cell: ({ row }) => row.original.divisionName ?? "Any division",
  }),
  col.accessor((r) => r.entryType ?? "any", {
    id: "entryType",
    header: "Entry type",
    filterFn: "equals",
    meta: { priority: "low" },
    cell: ({ row }) =>
      row.original.entryType ? ENTRY_TYPE_LABELS[row.original.entryType] : "Any entry type",
  }),
  col.accessor((r) => r.description ?? "", {
    id: "description",
    header: "Description",
    enableSorting: false,
    meta: { priority: "low" },
    cell: ({ getValue }) => getValue() || "—",
  }),
  col.accessor((r) => (r.active ? "active" : "inactive"), {
    id: "active",
    header: "Active",
    filterFn: "equals",
    enableSorting: false,
    cell: ({ row }) => <FeeActiveSwitch f={row.original} />,
  }),
  col.display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    meta: { rowActions: true },
    cell: ({ row }) => <FeeActions f={row.original} />,
  }),
];

export function FeesTable({
  eventId,
  rows,
  divisions,
}: {
  eventId: string;
  rows: FeeRow[];
  divisions: { id: string; name: string }[];
}) {
  const add = (
    <FormDialog
      title="Add fee"
      description="Leave Division or Entry type on Any to apply a fee broadly."
      trigger={
        <Button>
          <Plus aria-hidden /> Add fee
        </Button>
      }
    >
      {(close) => <FeeForm eventId={eventId} divisions={divisions} close={close} />}
    </FormDialog>
  );
  return (
    <FeesProvider value={{ eventId }}>
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        search={{ label: "Search fees", placeholder: "Search fees…" }}
        filters={[
          {
            columnId: "active",
            label: "Status",
            allLabel: "Active and inactive",
            options: [
              ["active", "Active"],
              ["inactive", "Inactive"],
            ],
          },
          {
            columnId: "division",
            label: "Division",
            allLabel: "All divisions",
            options: [["any", "Any division"], ...divisions.map((d) => [d.id, d.name] as const)],
          },
          {
            columnId: "entryType",
            label: "Entry type",
            allLabel: "All entry types",
            options: [["any", "Any entry type"], ...ENTRY_TYPE_OPTIONS],
          },
        ]}
        toolbar={add}
        empty={
          <EmptyState
            icon={Receipt}
            title="No fees set up yet"
            description="Add one, then apply it to registrations from Payments."
            action={
              <span className="flex flex-wrap justify-center gap-2">
                {add}
                <Button asChild variant="outline">
                  <Link href={`/admin/events/${eventId}/payments`}>Go to Payments</Link>
                </Button>
              </span>
            }
          />
        }
      />
    </FeesProvider>
  );
}
