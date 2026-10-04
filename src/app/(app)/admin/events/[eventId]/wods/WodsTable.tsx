"use client";

import { Dumbbell, Plus } from "lucide-react";
import { createWod, deleteWod, updateWod } from "@/lib/actions/wods";
import { dataTableColumns } from "@/lib/data-table";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { DataTable } from "@/components/app/data-table/DataTable";
import { EmptyState } from "@/components/app/EmptyState";
import { FormDialog } from "@/components/app/FormDialog";
import { RowActions, useEntityDialogs } from "@/components/app/RowActions";
import { Button } from "@/components/ui/button";
import { WodForm, type WodValues } from "./WodForm";
import { SCORING_LABEL, SCORING_TYPES, TIEBREAK_LABEL } from "./wodOptions";

export type WodRow = WodValues & { id: string };

function WodActions({ eventId, w }: { eventId: string; w: WodRow }) {
  const dialogs = useEntityDialogs<"edit" | "remove">();
  return (
    <>
      <RowActions
        label={`Actions for ${w.name}`}
        primary={{ label: "Edit", onSelect: dialogs.show("edit") }}
        destructive={[{ label: "Remove WOD", onSelect: dialogs.show("remove") }]}
      />
      <FormDialog title={`Edit ${w.name}`} {...dialogs.props("edit")}>
        {(close) => (
          <WodForm
            action={(fd) => updateWod(eventId, w.id, fd)}
            values={w}
            submitLabel="Save changes"
            pendingLabel="Saving…"
            success="WOD saved"
            close={close}
          />
        )}
      </FormDialog>
      <ConfirmAction
        {...dialogs.props("remove")}
        title={`Remove ${w.name}?`}
        description="The WOD is deleted with its heats, lanes and results. This cannot be undone."
        confirmLabel="Remove WOD"
        onConfirm={() => deleteWod(eventId, w.id)}
      />
    </>
  );
}

export function WodsTable({ eventId, rows }: { eventId: string; rows: WodRow[] }) {
  const col = dataTableColumns<WodRow>();
  const columns = [
    col.accessor("name", {
      header: "WOD",
      enableSorting: false,
      cell: ({ getValue }) => <span className="font-semibold">{getValue()}</span>,
    }),
    col.accessor("scoring_type", {
      header: "Scoring",
      enableSorting: false,
      filterFn: "equals",
      cell: ({ getValue }) => SCORING_LABEL[getValue()] ?? getValue(),
    }),
    col.accessor((r) => r.time_cap_seconds ?? 0, {
      id: "cap",
      header: "Time cap",
      enableSorting: false,
      cell: ({ row }) =>
        row.original.time_cap_seconds ? (
          <span className="tabular-nums">{row.original.time_cap_seconds / 60} min</span>
        ) : (
          "—"
        ),
    }),
    col.accessor("tiebreak_type", {
      header: "Tie-break",
      enableSorting: false,
      meta: { priority: "low" },
      cell: ({ getValue }) => TIEBREAK_LABEL[getValue()] ?? getValue(),
    }),
    col.accessor((r) => r.description ?? "", {
      id: "description",
      header: "Description",
      enableSorting: false,
      meta: { priority: "low", className: "max-w-xs" },
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
      cell: ({ row }) => <WodActions eventId={eventId} w={row.original} />,
    }),
  ];
  const add = (
    <FormDialog
      title="Add WOD"
      trigger={
        <Button>
          <Plus aria-hidden /> Add WOD
        </Button>
      }
    >
      {(close) => (
        <WodForm
          action={(fd) => createWod(eventId, fd)}
          submitLabel="Add WOD"
          pendingLabel="Adding…"
          success="WOD added"
          close={close}
        />
      )}
    </FormDialog>
  );
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      search={{ label: "Search WODs", placeholder: "Search WODs…" }}
      filters={[
        {
          columnId: "scoring_type",
          label: "Scoring",
          allLabel: "All scoring types",
          options: SCORING_TYPES,
        },
      ]}
      toolbar={add}
      empty={<EmptyState icon={Dumbbell} title="No WODs yet" action={add} />}
    />
  );
}
