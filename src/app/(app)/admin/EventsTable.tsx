"use client";

import Link from "next/link";
import { CalendarDays, ImageOff, Plus } from "lucide-react";
import type { EventStatus } from "@/lib/db/database.types";
import { deleteEvent, removeEventCoverPhoto } from "@/lib/actions/events";
import { dataTableColumns } from "@/lib/data-table";
import { formatDayRange } from "@/lib/time";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { DataTable } from "@/components/app/data-table/DataTable";
import { EmptyState } from "@/components/app/EmptyState";
import { FormDialog } from "@/components/app/FormDialog";
import { RowActions, useEntityDialogs } from "@/components/app/RowActions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CoverPhotoForm } from "./CoverPhotoForm";
import { NewEventForm } from "./NewEventForm";

export type EventRow = {
  id: string;
  name: string;
  status: EventStatus;
  startsOn: string | null;
  endsOn: string | null;
  circuitId: string | null;
  circuitName: string | null;
  coverUrl: string | null;
};

const STATUS_OPTIONS = [
  ["draft", "Draft"],
  ["scheduled", "Scheduled"],
  ["live", "Live"],
  ["completed", "Completed"],
  ["archived", "Archived"],
] as const;

function EventActions({ e }: { e: EventRow }) {
  const dialogs = useEntityDialogs<"cover" | "removeCover" | "delete">();
  return (
    <>
      <RowActions
        label={`Actions for ${e.name}`}
        secondary={[
          { label: "Open", href: `/admin/events/${e.id}` },
          {
            label: e.coverUrl ? "Change cover photo" : "Upload cover photo",
            onSelect: dialogs.show("cover"),
          },
        ]}
        destructive={[
          ...(e.coverUrl
            ? [{ label: "Remove cover photo", onSelect: dialogs.show("removeCover") }]
            : []),
          { label: "Delete event", onSelect: dialogs.show("delete") },
        ]}
      />
      <FormDialog title={`Cover photo for ${e.name}`} {...dialogs.props("cover")}>
        {(close) => <CoverPhotoForm eventId={e.id} close={close} />}
      </FormDialog>
      <ConfirmAction
        {...dialogs.props("removeCover")}
        title={`Remove the cover photo from ${e.name}?`}
        description="The event goes back to having no cover photo. You can upload a new one any time."
        confirmLabel="Remove photo"
        onConfirm={() => removeEventCoverPhoto(e.id)}
      />
      <ConfirmAction
        {...dialogs.props("delete")}
        title={`Delete ${e.name}?`}
        description="This permanently removes its divisions, registrations, heats, results, standings, fees and payment records. This cannot be undone."
        confirmLabel="Delete event"
        onConfirm={() => deleteEvent(e.id)}
      />
    </>
  );
}

const col = dataTableColumns<EventRow>();

const columns = [
  col.accessor("name", {
    header: "Event",
    cell: ({ row }) => (
      <Link
        href={`/admin/events/${row.original.id}`}
        className="flex items-center gap-3 font-semibold hover:underline"
      >
        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
          {row.original.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, not a local/optimizable asset
            <img src={row.original.coverUrl} alt="" className="size-full object-cover" />
          ) : (
            <ImageOff aria-hidden className="size-4 text-muted-foreground" />
          )}
        </span>
        {row.original.name}
      </Link>
    ),
  }),
  col.accessor("status", {
    header: "Status",
    filterFn: "equals",
    cell: ({ getValue }) => (
      <Badge variant={getValue() === "live" ? "default" : "secondary"} className="uppercase">
        {getValue()}
      </Badge>
    ),
  }),
  col.accessor((r) => r.startsOn ?? "", {
    id: "dates",
    header: "Dates",
    cell: ({ row }) => formatDayRange(row.original.startsOn, row.original.endsOn),
  }),
  col.accessor((r) => r.circuitId ?? "none", {
    id: "circuit",
    header: "Circuit",
    filterFn: "equals",
    meta: { priority: "low" },
    cell: ({ row }) => row.original.circuitName ?? "—",
  }),
  col.display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    meta: { rowActions: true },
    cell: ({ row }) => <EventActions e={row.original} />,
  }),
];

export function EventsTable({
  rows,
  circuits,
}: {
  rows: EventRow[];
  circuits: { id: string; name: string }[];
}) {
  const create = (
    <FormDialog
      title="New event"
      trigger={
        <Button>
          <Plus aria-hidden /> New event
        </Button>
      }
    >
      {() => <NewEventForm circuits={circuits} />}
    </FormDialog>
  );
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      search={{ label: "Search events", placeholder: "Search events…" }}
      filters={[
        { columnId: "status", label: "Status", allLabel: "All statuses", options: STATUS_OPTIONS },
        {
          columnId: "circuit",
          label: "Circuit",
          allLabel: "All circuits",
          options: [["none", "Standalone"], ...circuits.map((c) => [c.id, c.name] as const)],
        },
      ]}
      toolbar={create}
      empty={
        <EmptyState
          icon={CalendarDays}
          title="No events yet"
          description="Create your first event."
          action={create}
        />
      }
    />
  );
}
