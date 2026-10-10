"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, MonitorPlay, Plus, Settings2 } from "lucide-react";
import { toggleDisplayEnabled } from "@/lib/actions/displays";
import { dataTableColumns } from "@/lib/data-table";
import { ActionSwitch } from "@/components/app/ActionSwitch";
import { DataTable } from "@/components/app/data-table/DataTable";
import { createTableContext } from "@/components/app/data-table/tableContext";
import { EmptyState } from "@/components/app/EmptyState";
import { FormDialog } from "@/components/app/FormDialog";
import { RowActions, useEntityDialogs } from "@/components/app/RowActions";
import { Button } from "@/components/ui/button";
import { AddDisplayForm, type DisplaySettings, DisplaySettingsForm } from "./DisplayForms";

export type DisplayRow = DisplaySettings & {
  id: string;
  name: string;
  floorName: string;
  enabled: boolean;
};

const [DisplaysProvider, useDisplays] = createTableContext<{ eventId: string }>("DisplaysTable");

const playerPath = (eventId: string, displayId: string) => `/display/${eventId}/${displayId}`;

function DisplayActions({ d }: { d: DisplayRow }) {
  const { eventId } = useDisplays();
  const dialogs = useEntityDialogs<"settings">();
  const [copied, setCopied] = useState(false);
  const path = playerPath(eventId, d.id);
  return (
    <>
      <RowActions
        label={`Actions for ${d.name}`}
        primary={{
          label: copied ? "Copied" : "Copy URL",
          ariaLabel: `Copy ${d.name}'s URL`,
          icon: copied ? Check : Copy,
          onSelect: () => {
            void navigator.clipboard.writeText(`${window.location.origin}${path}`).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          },
        }}
        secondary={[
          {
            label: "Open",
            icon: ExternalLink,
            onSelect: () => window.open(path, "_blank", "noopener"),
          },
          { label: "Settings", icon: Settings2, onSelect: dialogs.show("settings") },
        ]}
      />
      <FormDialog
        {...dialogs.props("settings")}
        title={`${d.name} settings`}
        description="Weight 2 shows twice as often as weight 1. Sponsors' times and weights come from their packages."
      >
        {(close) => (
          <DisplaySettingsForm eventId={eventId} displayId={d.id} settings={d} close={close} />
        )}
      </FormDialog>
    </>
  );
}

function ActiveSwitch({ d }: { d: DisplayRow }) {
  const { eventId } = useDisplays();
  return (
    <ActionSwitch
      checked={d.enabled}
      action={(next) => toggleDisplayEnabled(eventId, d.id, next)}
      label={`${d.name} on`}
    />
  );
}

const col = dataTableColumns<DisplayRow>();

const columns = [
  col.accessor("name", {
    header: "Display",
    cell: ({ row: { original: d } }) => (
      <span className="flex flex-col">
        <span className="font-semibold">{d.name}</span>
        <span className="text-sm text-muted-foreground">{d.floorName}</span>
      </span>
    ),
  }),
  col.accessor((d) => d.blocks.filter((b) => b.enabled).length, {
    id: "rotation",
    header: "Rotation",
    meta: { priority: "low" },
    enableSorting: false,
    cell: ({ row: { original: d } }) => {
      const blocks = d.blocks.filter((b) => b.enabled).length;
      return d.sponsorsEnabled
        ? `Sponsors · ${blocks} info ${blocks === 1 ? "block" : "blocks"}`
        : `${blocks} info ${blocks === 1 ? "block" : "blocks"}, no sponsors`;
    },
  }),
  col.accessor((d) => (d.enabled ? "on" : "off"), {
    id: "enabled",
    header: "On",
    enableSorting: false,
    cell: ({ row }) => <ActiveSwitch d={row.original} />,
  }),
  col.display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    meta: { rowActions: true },
    cell: ({ row }) => <DisplayActions d={row.original} />,
  }),
];

export function DisplaysTable({
  eventId,
  rows,
  floors,
}: {
  eventId: string;
  rows: DisplayRow[];
  floors: { id: string; name: string }[];
}) {
  const add =
    floors.length > 0 ? (
      <FormDialog
        title="Add display"
        trigger={
          <Button>
            <Plus aria-hidden /> Add display
          </Button>
        }
      >
        {(close) => <AddDisplayForm eventId={eventId} floors={floors} close={close} />}
      </FormDialog>
    ) : null;
  return (
    <DisplaysProvider value={{ eventId }}>
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(d) => d.id}
        toolbar={add}
        empty={
          <EmptyState
            icon={MonitorPlay}
            title="No displays yet."
            description={add ? undefined : "Add a floor to this event's venue first."}
            action={add ?? undefined}
          />
        }
      />
    </DisplaysProvider>
  );
}
