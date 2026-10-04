"use client";

import Link from "next/link";
import { Plus, Route as RouteIcon } from "lucide-react";
import { deleteCircuit } from "@/lib/actions/circuits";
import { dataTableColumns } from "@/lib/data-table";
import { formatDayRange } from "@/lib/time";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { DataTable } from "@/components/app/data-table/DataTable";
import { EmptyState } from "@/components/app/EmptyState";
import { FormDialog } from "@/components/app/FormDialog";
import { RowActions, useEntityDialogs } from "@/components/app/RowActions";
import { Button } from "@/components/ui/button";
import { CircuitForm } from "./CircuitForm";

export type CircuitRow = {
  id: string;
  name: string;
  description: string | null;
  startsOn: string | null;
  endsOn: string | null;
  events: number;
};

function CircuitActions({ c }: { c: CircuitRow }) {
  const dialogs = useEntityDialogs<"delete">();
  return (
    <>
      <RowActions
        label={`Actions for ${c.name}`}
        secondary={[{ label: "Open", href: `/admin/circuits/${c.id}` }]}
        destructive={[{ label: "Delete circuit", onSelect: dialogs.show("delete") }]}
      />
      <ConfirmAction
        {...dialogs.props("delete")}
        title={`Delete ${c.name}?`}
        description="The circuit and its cumulative leaderboard go away. Its events stay, as standalone events with their own results."
        confirmLabel="Delete circuit"
        onConfirm={() => deleteCircuit(c.id)}
      />
    </>
  );
}

const col = dataTableColumns<CircuitRow>();

const columns = [
  col.accessor("name", {
    header: "Circuit",
    cell: ({ row }) => (
      <Link href={`/admin/circuits/${row.original.id}`} className="font-semibold hover:underline">
        {row.original.name}
      </Link>
    ),
  }),
  col.accessor("events", {
    header: "Events",
    cell: ({ getValue }) => <span className="tabular-nums">{getValue()}</span>,
  }),
  col.accessor((r) => r.startsOn ?? "", {
    id: "season",
    header: "Season",
    cell: ({ row }) =>
      row.original.startsOn || row.original.endsOn
        ? formatDayRange(row.original.startsOn ?? row.original.endsOn, row.original.endsOn, " → ")
        : "—",
  }),
  col.accessor((r) => r.description ?? "", {
    id: "description",
    header: "Description",
    enableSorting: false,
    meta: { priority: "low" },
    cell: ({ getValue }) => getValue() || "—",
  }),
  col.display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    meta: { rowActions: true },
    cell: ({ row }) => <CircuitActions c={row.original} />,
  }),
];

export function CircuitsTable({ rows }: { rows: CircuitRow[] }) {
  const create = (
    <FormDialog
      title="New circuit"
      description="A circuit groups several events into one season with a cumulative leaderboard."
      trigger={
        <Button>
          <Plus aria-hidden /> New circuit
        </Button>
      }
    >
      {() => <CircuitForm />}
    </FormDialog>
  );
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      search={{ label: "Search circuits", placeholder: "Search circuits…" }}
      toolbar={create}
      empty={
        <EmptyState
          icon={RouteIcon}
          title="No circuits yet"
          description="Start one here, or from the New event dialog on the Events page."
          action={create}
        />
      }
    />
  );
}
