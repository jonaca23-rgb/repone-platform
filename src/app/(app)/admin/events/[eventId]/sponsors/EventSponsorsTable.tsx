"use client";

import { BadgeDollarSign, Pencil, Plus } from "lucide-react";
import { toggleEventSponsorshipActive } from "@/lib/actions/eventSponsorships";
import { dataTableColumns } from "@/lib/data-table";
import { ActionSwitch } from "@/components/app/ActionSwitch";
import { DataTable } from "@/components/app/data-table/DataTable";
import { createTableContext } from "@/components/app/data-table/tableContext";
import { EmptyState } from "@/components/app/EmptyState";
import { FormDialog } from "@/components/app/FormDialog";
import { RowActions, useEntityDialogs } from "@/components/app/RowActions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AddEventSponsorForm,
  EditEventSponsorForm,
  type PackageOption,
  type SponsorOption,
} from "./EventSponsorForm";

export type EventSponsorshipRow = {
  id: string;
  sponsorId: string;
  packageId: string;
  sponsorName: string;
  category: string | null;
  packageName: string;
  exclusive: boolean;
  durationOverride: number | null;
  weightOverride: number | null;
  display: { enabled: boolean; durationSeconds: number; weight: number } | null;
  active: boolean;
};

const [EventProvider, useEventSponsors] = createTableContext<{
  eventId: string;
  packages: PackageOption[];
}>("EventSponsorsTable");

function SponsorshipActions({ r }: { r: EventSponsorshipRow }) {
  const { eventId, packages } = useEventSponsors();
  const dialogs = useEntityDialogs<"edit">();
  return (
    <>
      <RowActions
        label={`Actions for ${r.sponsorName}`}
        primary={{
          label: "Edit",
          ariaLabel: `Edit ${r.sponsorName}'s sponsorship`,
          icon: Pencil,
          onSelect: dialogs.show("edit"),
        }}
      />
      <FormDialog {...dialogs.props("edit")} title={`${r.sponsorName} at this event`}>
        {(close) => (
          <EditEventSponsorForm
            eventId={eventId}
            sponsorship={r}
            packages={packages}
            close={close}
          />
        )}
      </FormDialog>
    </>
  );
}

function ActiveSwitch({ r }: { r: EventSponsorshipRow }) {
  const { eventId } = useEventSponsors();
  return (
    <ActionSwitch
      checked={r.active}
      action={(next) => toggleEventSponsorshipActive(eventId, r.id, next)}
      label={`${r.sponsorName} at this event`}
    />
  );
}

const col = dataTableColumns<EventSponsorshipRow>();

const columns = [
  col.accessor("sponsorName", {
    header: "Sponsor",
    cell: ({ row: { original: r } }) => (
      <span className="flex flex-wrap items-center gap-2 font-semibold">
        {r.sponsorName}
        {r.exclusive && r.category ? (
          <Badge variant="outline" className="h-auto whitespace-normal text-brand-text">
            Exclusive · {r.category}
          </Badge>
        ) : null}
      </span>
    ),
  }),
  col.accessor("packageName", { header: "Package" }),
  col.accessor((r) => r.display?.weight ?? 0, {
    id: "display",
    header: "Venue display",
    meta: { priority: "low" },
    cell: ({ row: { original: r } }) => {
      if (!r.display?.enabled) return "Not shown";
      const overridden = r.durationOverride !== null || r.weightOverride !== null;
      return (
        <span className="flex flex-wrap items-center gap-2 tabular-nums">
          {r.display.durationSeconds} s · weight {r.display.weight}
          {overridden ? <Badge variant="secondary">Override</Badge> : null}
        </span>
      );
    },
  }),
  col.accessor((r) => (r.active ? "active" : "inactive"), {
    id: "active",
    header: "Active",
    enableSorting: false,
    cell: ({ row }) => <ActiveSwitch r={row.original} />,
  }),
  col.display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    meta: { rowActions: true },
    cell: ({ row }) => <SponsorshipActions r={row.original} />,
  }),
];

export function EventSponsorsTable({
  eventId,
  rows,
  availableSponsors,
  packages,
}: {
  eventId: string;
  rows: EventSponsorshipRow[];
  availableSponsors: SponsorOption[];
  packages: PackageOption[];
}) {
  const add =
    availableSponsors.length > 0 ? (
      <FormDialog
        title="Add sponsor to this event"
        description="Choose what the sponsor bought. Sponsors are created on the organization's Sponsors page."
        trigger={
          <Button>
            <Plus aria-hidden /> Add sponsor
          </Button>
        }
      >
        {(close) => (
          <AddEventSponsorForm
            eventId={eventId}
            sponsors={availableSponsors}
            packages={packages}
            close={close}
          />
        )}
      </FormDialog>
    ) : null;

  return (
    <EventProvider value={{ eventId, packages }}>
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        toolbar={add}
        empty={
          <EmptyState
            icon={BadgeDollarSign}
            title="No sponsors at this event yet."
            description={
              add ? undefined : "Add sponsors on the organization's Sponsors page first."
            }
            action={add ?? undefined}
          />
        }
      />
    </EventProvider>
  );
}
