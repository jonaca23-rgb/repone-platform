"use client";

import { Pencil, Plus, Tags } from "lucide-react";
import { deleteDivision } from "@/lib/actions/divisions";
import { type EntryFormat, formatLabel } from "@/lib/teams/format";
import { dataTableColumns } from "@/lib/data-table";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { DataTable } from "@/components/app/data-table/DataTable";
import { createTableContext } from "@/components/app/data-table/tableContext";
import { EmptyState } from "@/components/app/EmptyState";
import { FormDialog } from "@/components/app/FormDialog";
import { RowActions, useEntityDialogs } from "@/components/app/RowActions";
import { Button } from "@/components/ui/button";
import { DivisionForm } from "./DivisionForm";

export type DivisionRow = {
  id: string;
  name: string;
  entry_format: EntryFormat;
  team_size: number | null;
};

function DivisionActions({ d }: { d: DivisionRow }) {
  const { eventId } = useDivisions();
  const dialogs = useEntityDialogs<"edit" | "remove">();
  return (
    <>
      <RowActions
        label={`Actions for ${d.name}`}
        secondary={[{ label: "Edit", icon: Pencil, onSelect: dialogs.show("edit") }]}
        destructive={[{ label: "Remove division", onSelect: dialogs.show("remove") }]}
      />
      <FormDialog {...dialogs.props("edit")} title={`Edit ${d.name}`}>
        {(close) => <DivisionForm eventId={eventId} division={d} close={close} />}
      </FormDialog>
      <ConfirmAction
        {...dialogs.props("remove")}
        title={`Remove ${d.name}?`}
        description="The division is deleted with its registrations, teams, heats and results. This cannot be undone."
        confirmLabel="Remove division"
        onConfirm={() => deleteDivision(eventId, d.id)}
      />
    </>
  );
}

const [DivisionsProvider, useDivisions] = createTableContext<{ eventId: string }>("DivisionsTable");

const col = dataTableColumns<DivisionRow>();
const columns = [
  col.accessor("name", {
    header: "Division",
    enableSorting: false,
    cell: ({ getValue }) => <span className="font-semibold">{getValue()}</span>,
  }),
  col.accessor((d) => formatLabel(d.entry_format, d.team_size), {
    id: "format",
    header: "Format",
    enableSorting: false,
  }),
  col.display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    meta: { rowActions: true },
    cell: ({ row }) => <DivisionActions d={row.original} />,
  }),
];

export function DivisionsTable({ eventId, rows }: { eventId: string; rows: DivisionRow[] }) {
  const add = (
    <FormDialog
      title="Add division"
      trigger={
        <Button>
          <Plus aria-hidden /> Add division
        </Button>
      }
    >
      {(close) => <DivisionForm eventId={eventId} close={close} />}
    </FormDialog>
  );
  return (
    <DivisionsProvider value={{ eventId }}>
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        toolbar={add}
        empty={<EmptyState icon={Tags} title="No divisions yet" action={add} />}
      />
    </DivisionsProvider>
  );
}
