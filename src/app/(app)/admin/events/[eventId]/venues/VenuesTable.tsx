"use client";

import { MapPin, Plus } from "lucide-react";
import { addFloor } from "@/lib/actions/venues";
import { dataTableColumns } from "@/lib/data-table";
import { DataTable } from "@/components/app/data-table/DataTable";
import { EmptyState } from "@/components/app/EmptyState";
import { FormDialog } from "@/components/app/FormDialog";
import { NameForm } from "@/components/app/NameForm";
import { RowActions, useEntityDialogs } from "@/components/app/RowActions";
import { Badge } from "@/components/ui/badge";

export type VenueRow = { id: string; name: string; floors: { id: string; name: string }[] };

function VenueActions({ eventId, v }: { eventId: string; v: VenueRow }) {
  const dialogs = useEntityDialogs<"floor">();
  return (
    <>
      <RowActions
        label={`Actions for ${v.name}`}
        primary={{ label: "Add floor", icon: Plus, onSelect: dialogs.show("floor") }}
      />
      <FormDialog title={`Add a floor to ${v.name}`} {...dialogs.props("floor")}>
        {(close) => (
          <NameForm
            action={(fd) => addFloor(eventId, v.id, fd)}
            label="New floor name"
            placeholder="Floor B"
            submitLabel="Add floor"
            pendingLabel="Adding…"
            success="Floor added"
            close={close}
          />
        )}
      </FormDialog>
    </>
  );
}

export function VenuesTable({ eventId, rows }: { eventId: string; rows: VenueRow[] }) {
  const col = dataTableColumns<VenueRow>();
  const columns = [
    col.accessor("name", {
      header: "Venue",
      enableSorting: false,
      cell: ({ getValue }) => <span className="font-semibold">{getValue()}</span>,
    }),
    col.display({
      id: "floors",
      header: "Floors",
      cell: ({ row }) => (
        <span className="flex flex-wrap gap-1">
          {row.original.floors.map((f) => (
            <Badge key={f.id} variant="secondary">
              {f.name}
            </Badge>
          ))}
        </span>
      ),
    }),
    col.display({
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      meta: { rowActions: true },
      cell: ({ row }) => <VenueActions eventId={eventId} v={row.original} />,
    }),
  ];
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      empty={
        <EmptyState
          icon={MapPin}
          title="No venues yet"
          description="Every new event gets a Main Venue with Floor A."
        />
      }
    />
  );
}
