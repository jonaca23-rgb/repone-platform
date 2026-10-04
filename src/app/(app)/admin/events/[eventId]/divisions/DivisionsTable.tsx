"use client";

import { Plus, Tags } from "lucide-react";
import { createDivision, deleteDivision } from "@/lib/actions/divisions";
import { dataTableColumns } from "@/lib/data-table";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { DataTable } from "@/components/app/data-table/DataTable";
import { createTableContext } from "@/components/app/data-table/tableContext";
import { EmptyState } from "@/components/app/EmptyState";
import { FormDialog } from "@/components/app/FormDialog";
import { NameForm } from "@/components/app/NameForm";
import { RowActions, useEntityDialogs } from "@/components/app/RowActions";
import { Button } from "@/components/ui/button";

export type DivisionRow = { id: string; name: string };

function DivisionActions({ d }: { d: DivisionRow }) {
  const { eventId } = useDivisions();
  const dialogs = useEntityDialogs<"remove">();
  return (
    <>
      <RowActions
        label={`Actions for ${d.name}`}
        destructive={[{ label: "Remove division", onSelect: dialogs.show("remove") }]}
      />
      <ConfirmAction
        {...dialogs.props("remove")}
        title={`Remove ${d.name}?`}
        description="The division is deleted with its registrations, heats and results. This cannot be undone."
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
      {(close) => (
        <NameForm
          action={(fd) => createDivision(eventId, fd)}
          label="Division name"
          placeholder="Intermediate Female"
          submitLabel="Add division"
          pendingLabel="Adding…"
          success="Division added"
          close={close}
        />
      )}
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
