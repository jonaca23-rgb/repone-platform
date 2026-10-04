"use client";

import Link from "next/link";
import { Check, ListOrdered, Plus, Shuffle } from "lucide-react";
import { deleteHeat } from "@/lib/actions/heats";
import { dataTableColumns } from "@/lib/data-table";
import { formatTime } from "@/lib/time";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { DataTable } from "@/components/app/data-table/DataTable";
import { EmptyState } from "@/components/app/EmptyState";
import { FormDialog } from "@/components/app/FormDialog";
import { RowActions, useEntityDialogs } from "@/components/app/RowActions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddHeatForm, GenerateHeatsForm, type HeatChoices } from "./HeatForms";

export type HeatRow = {
  id: string;
  label: string;
  wodId: string;
  divisionId: string;
  divisionName: string;
  floorId: string;
  floorName: string;
  lanes: number;
  start: string | null;
  status: "completed" | "next" | "pending";
};

function HeatActions({ eventId, h }: { eventId: string; h: HeatRow }) {
  const dialogs = useEntityDialogs<"remove">();
  return (
    <>
      <RowActions
        label={`Actions for ${h.label}`}
        primary={{ label: "Open", href: `/admin/events/${eventId}/heats/${h.id}` }}
        destructive={[{ label: "Remove heat", onSelect: dialogs.show("remove") }]}
      />
      <ConfirmAction
        {...dialogs.props("remove")}
        title={`Remove ${h.label}?`}
        description="The heat is deleted with its lane assignments and any results entered for it. This cannot be undone."
        confirmLabel="Remove heat"
        onConfirm={() => deleteHeat(eventId, h.id)}
      />
    </>
  );
}

export function HeatsTable({
  eventId,
  rows,
  choices,
  wods,
  lanesPerHeat,
}: {
  eventId: string;
  rows: HeatRow[];
  choices: HeatChoices;
  wods: { value: string; label: string }[];
  lanesPerHeat: number;
}) {
  const col = dataTableColumns<HeatRow>();
  const columns = [
    col.accessor("label", {
      header: "Heat",
      enableSorting: false,
      cell: ({ row }) => (
        <Link
          href={`/admin/events/${eventId}/heats/${row.original.id}`}
          className="font-semibold hover:underline"
        >
          {row.original.label}
        </Link>
      ),
    }),
    col.accessor("status", {
      header: "Status",
      enableSorting: false,
      filterFn: "equals",
      cell: ({ getValue }) =>
        getValue() === "completed" ? (
          <Badge className="border-success/40 bg-success/10 text-success-text uppercase">
            <Check aria-hidden />
            Completed
          </Badge>
        ) : getValue() === "next" ? (
          <Badge className="uppercase">Next up</Badge>
        ) : (
          <span className="text-muted-foreground">Pending</span>
        ),
    }),
    col.accessor("divisionId", {
      header: "Division",
      enableSorting: false,
      filterFn: "equals",
      cell: ({ row }) => row.original.divisionName,
    }),
    col.accessor("floorId", {
      header: "Floor",
      enableSorting: false,
      filterFn: "equals",
      cell: ({ row }) => row.original.floorName,
    }),
    col.accessor("wodId", {
      header: "WOD",
      enableSorting: false,
      filterFn: "equals",
      meta: { className: "hidden" },
    }),
    col.accessor((r) => r.start ?? "", {
      id: "start",
      header: "Start",
      enableSorting: false,
      meta: { priority: "low" },
      cell: ({ row }) =>
        row.original.start ? (
          <span className="tabular-nums">{formatTime(row.original.start)}</span>
        ) : (
          "—"
        ),
    }),
    col.accessor("lanes", {
      header: "Lanes",
      enableSorting: false,
      meta: { priority: "low" },
      cell: ({ getValue }) => <span className="tabular-nums">{getValue()}</span>,
    }),
    col.display({
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      meta: { rowActions: true },
      cell: ({ row }) => <HeatActions eventId={eventId} h={row.original} />,
    }),
  ];
  const generate = (
    <FormDialog
      title="Generate heats"
      description="Every athlete or team registered in the division is slotted into lanes, across as many heats as it takes."
      trigger={
        <Button>
          <Shuffle aria-hidden /> Generate heats
        </Button>
      }
    >
      {(close) => (
        <GenerateHeatsForm
          eventId={eventId}
          choices={choices}
          lanesPerHeat={lanesPerHeat}
          close={close}
        />
      )}
    </FormDialog>
  );
  const addOne = (
    <FormDialog
      title="Add a single heat"
      trigger={
        <Button variant="outline">
          <Plus aria-hidden /> Add single heat
        </Button>
      }
    >
      {(close) => <AddHeatForm eventId={eventId} choices={choices} close={close} />}
    </FormDialog>
  );
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      filters={[
        {
          columnId: "wodId",
          label: "WOD",
          allLabel: "All WODs",
          options: wods.map((w) => [w.value, w.label] as const),
        },
        {
          columnId: "divisionId",
          label: "Division",
          allLabel: "All divisions",
          options: choices.divisions.map((d) => [d.value, d.label] as const),
        },
        {
          columnId: "floorId",
          label: "Floor",
          allLabel: "All floors",
          options: choices.floors.map((f) => [f.value, f.label] as const),
        },
        {
          columnId: "status",
          label: "Status",
          allLabel: "All statuses",
          options: [
            ["next", "Next up"],
            ["pending", "Pending"],
            ["completed", "Completed"],
          ],
        },
      ]}
      toolbar={
        <>
          {generate}
          {addOne}
        </>
      }
      empty={
        <EmptyState
          icon={ListOrdered}
          title="No heats yet"
          description="Generate heats for a division, or add one by hand."
          action={
            <span className="flex flex-wrap justify-center gap-2">
              {generate}
              {addOne}
            </span>
          }
        />
      }
    />
  );
}
