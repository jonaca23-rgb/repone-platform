"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { removeEventFromCircuit } from "@/lib/actions/circuits";
import { dataTableColumns } from "@/lib/data-table";
import { formatDayRange } from "@/lib/time";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { DataTable } from "@/components/app/data-table/DataTable";
import { createTableContext } from "@/components/app/data-table/tableContext";
import { EmptyState } from "@/components/app/EmptyState";
import { RowActions, useEntityDialogs } from "@/components/app/RowActions";
import { Badge } from "@/components/ui/badge";

export type CircuitEventRow = {
  id: string;
  name: string;
  status: string;
  startsOn: string | null;
  endsOn: string | null;
};

const [CircuitProvider, useCircuit] = createTableContext<{
  circuitId: string;
  circuitName: string;
}>("CircuitEventsTable");

function CircuitEventActions({ e }: { e: CircuitEventRow }) {
  const { circuitId, circuitName } = useCircuit();
  const dialogs = useEntityDialogs<"remove">();
  return (
    <>
      <RowActions
        label={`Actions for ${e.name}`}
        secondary={[{ label: "Open", href: `/admin/events/${e.id}` }]}
        destructive={[{ label: "Remove from circuit", onSelect: dialogs.show("remove") }]}
      />
      <ConfirmAction
        {...dialogs.props("remove")}
        title={`Remove ${e.name} from ${circuitName}?`}
        description="The event becomes standalone and its results stop counting toward this circuit's leaderboard. You can add it back later."
        confirmLabel="Remove from circuit"
        onConfirm={() => removeEventFromCircuit(circuitId, e.id)}
      />
    </>
  );
}

const col = dataTableColumns<CircuitEventRow>();
const columns = [
  col.accessor("name", {
    header: "Event",
    enableSorting: false,
    cell: ({ row }) => (
      <Link href={`/admin/events/${row.original.id}`} className="font-semibold hover:underline">
        {row.original.name}
      </Link>
    ),
  }),
  col.accessor("status", {
    header: "Status",
    enableSorting: false,
    cell: ({ getValue }) => (
      <Badge variant="outline" className="uppercase">
        {getValue()}
      </Badge>
    ),
  }),
  col.accessor((r) => r.startsOn ?? "", {
    id: "dates",
    header: "Dates",
    enableSorting: false,
    meta: { priority: "low" },
    cell: ({ row }) => formatDayRange(row.original.startsOn, row.original.endsOn),
  }),
  col.display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    meta: { rowActions: true },
    cell: ({ row }) => <CircuitEventActions e={row.original} />,
  }),
];

/** The circuit's events, in season order. */
export function CircuitEventsTable({
  circuitId,
  circuitName,
  rows,
}: {
  circuitId: string;
  circuitName: string;
  rows: CircuitEventRow[];
}) {
  return (
    <CircuitProvider value={{ circuitId, circuitName }}>
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        empty={
          <EmptyState
            icon={CalendarDays}
            title="No events yet"
            description="Add a standalone event, or create a new event and choose this circuit."
          />
        }
      />
    </CircuitProvider>
  );
}
