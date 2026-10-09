"use client";

import { BadgeDollarSign, ImageIcon, Images, Pencil, Plus } from "lucide-react";
import { toggleSponsorActive } from "@/lib/actions/sponsors";
import { dataTableColumns } from "@/lib/data-table";
import { ActionSwitch } from "@/components/app/ActionSwitch";
import { DataTable } from "@/components/app/data-table/DataTable";
import { EmptyState } from "@/components/app/EmptyState";
import { FormDialog } from "@/components/app/FormDialog";
import { RowActions, useEntityDialogs } from "@/components/app/RowActions";
import { Button } from "@/components/ui/button";
import { SponsorForm } from "./SponsorForm";
import { type Creative, SponsorCreatives, SponsorLogoForm } from "./SponsorImages";

export type SponsorRow = {
  id: string;
  business_name: string;
  category: string | null;
  website: string | null;
  notes: string | null;
  logo_url: string | null;
  active: boolean;
  creatives: Creative[];
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function SponsorActions({ s }: { s: SponsorRow }) {
  const dialogs = useEntityDialogs<"edit" | "logo" | "creatives">();
  return (
    <>
      <RowActions
        label={`Actions for ${s.business_name}`}
        primary={{
          label: "Creatives",
          ariaLabel: `Creatives for ${s.business_name}`,
          icon: Images,
          onSelect: dialogs.show("creatives"),
        }}
        secondary={[
          { label: "Edit", icon: Pencil, onSelect: dialogs.show("edit") },
          {
            label: s.logo_url ? "Replace logo" : "Add logo",
            icon: ImageIcon,
            onSelect: dialogs.show("logo"),
          },
        ]}
      />
      <FormDialog {...dialogs.props("edit")} title={`Edit ${s.business_name}`}>
        {(close) => <SponsorForm sponsor={s} close={close} />}
      </FormDialog>
      <FormDialog {...dialogs.props("logo")} title={`${s.business_name} logo`}>
        {(close) => <SponsorLogoForm sponsorId={s.id} close={close} />}
      </FormDialog>
      <FormDialog
        {...dialogs.props("creatives")}
        title={`${s.business_name} creatives`}
        description="Full-screen images the venue display rotates while this sponsor is at an event."
      >
        {() => (
          <SponsorCreatives
            sponsorId={s.id}
            sponsorName={s.business_name}
            creatives={s.creatives}
          />
        )}
      </FormDialog>
    </>
  );
}

const col = dataTableColumns<SponsorRow>();

const columns = [
  col.accessor("business_name", {
    header: "Sponsor",
    cell: ({ row }) => (
      <span className="flex items-center gap-3 font-semibold">
        {row.original.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.original.logo_url}
            alt=""
            className="size-10 shrink-0 rounded-md border border-border bg-muted object-contain"
          />
        ) : (
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-bold text-muted-foreground"
          >
            {initials(row.original.business_name)}
          </span>
        )}
        {row.original.business_name}
      </span>
    ),
  }),
  col.accessor("category", {
    header: "Category",
    meta: { priority: "low" },
    cell: ({ getValue }) => getValue() ?? "—",
  }),
  col.accessor((r) => r.creatives.filter((c) => c.active).length, {
    id: "creatives",
    header: "Creatives",
    meta: { priority: "low" },
    cell: ({ getValue }) =>
      getValue() > 0 ? <span className="tabular-nums">{getValue()}</span> : "None",
  }),
  col.accessor((r) => (r.active ? "active" : "inactive"), {
    id: "active",
    header: "Active",
    filterFn: "equals",
    enableSorting: false,
    cell: ({ row }) => (
      <ActionSwitch
        checked={row.original.active}
        action={toggleSponsorActive.bind(null, row.original.id)}
        label={`${row.original.business_name} active`}
      />
    ),
  }),
  col.display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    meta: { rowActions: true },
    cell: ({ row }) => <SponsorActions s={row.original} />,
  }),
];

export function SponsorsTable({ rows }: { rows: SponsorRow[] }) {
  const add = (
    <FormDialog
      title="Add sponsor"
      description="Add the sponsor once; choose its package on each event's Sponsors page."
      trigger={
        <Button>
          <Plus aria-hidden /> Add sponsor
        </Button>
      }
    >
      {(close) => <SponsorForm close={close} />}
    </FormDialog>
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      search={{ label: "Search sponsors", placeholder: "Search sponsors…" }}
      filters={[
        {
          columnId: "active",
          label: "Status",
          allLabel: "Active and inactive",
          options: [
            ["active", "Active"],
            ["inactive", "Inactive"],
          ],
        },
      ]}
      toolbar={add}
      empty={
        <EmptyState
          icon={BadgeDollarSign}
          title="No sponsors yet"
          description="Add your first sponsor."
          action={add}
        />
      }
    />
  );
}
