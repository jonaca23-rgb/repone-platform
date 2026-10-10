"use client";

import { Package, Pencil, Plus } from "lucide-react";
import { togglePackageActive } from "@/lib/actions/sponsorPackages";
import { dataTableColumns } from "@/lib/data-table";
import { ActionSwitch } from "@/components/app/ActionSwitch";
import { DataTable } from "@/components/app/data-table/DataTable";
import { EmptyState } from "@/components/app/EmptyState";
import { FormDialog } from "@/components/app/FormDialog";
import { RowActions, useEntityDialogs } from "@/components/app/RowActions";
import { Button } from "@/components/ui/button";
import { PackageForm, type PackageRow } from "./PackageForm";

export type { PackageRow } from "./PackageForm";

function PackageActions({ p }: { p: PackageRow }) {
  const dialogs = useEntityDialogs<"edit">();
  return (
    <>
      <RowActions
        label={`Actions for ${p.name}`}
        primary={{
          label: "Edit",
          ariaLabel: `Edit ${p.name}`,
          icon: Pencil,
          onSelect: dialogs.show("edit"),
        }}
      />
      <FormDialog {...dialogs.props("edit")} title={`Edit ${p.name}`}>
        {(close) => <PackageForm pkg={p} close={close} />}
      </FormDialog>
    </>
  );
}

const col = dataTableColumns<PackageRow>();

const columns = [
  col.accessor("name", {
    header: "Package",
    cell: ({ getValue }) => <span className="font-semibold">{getValue()}</span>,
  }),
  col.accessor((p) => (p.display_enabled ? p.display_weight : 0), {
    id: "display",
    header: "On the venue display",
    cell: ({ row: { original: p } }) =>
      p.display_enabled ? (
        <span className="tabular-nums">
          Yes · {p.display_duration_seconds} s · weight {p.display_weight}
        </span>
      ) : (
        "No"
      ),
  }),
  col.accessor("sort_order", {
    header: "Order",
    meta: { priority: "low" },
    cell: ({ getValue }) => <span className="tabular-nums">{getValue()}</span>,
  }),
  col.accessor((p) => (p.active ? "active" : "inactive"), {
    id: "active",
    header: "Active",
    enableSorting: false,
    cell: ({ row }) => (
      <ActionSwitch
        checked={row.original.active}
        action={togglePackageActive.bind(null, row.original.id)}
        label={`${row.original.name} active`}
      />
    ),
  }),
  col.display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    meta: { rowActions: true },
    cell: ({ row }) => <PackageActions p={row.original} />,
  }),
];

export function PackagesTable({ rows }: { rows: PackageRow[] }) {
  const add = (
    <FormDialog
      title="Add package"
      description="What a sponsor can buy for an event, and how it shows on the venue display."
      trigger={
        <Button>
          <Plus aria-hidden /> Add package
        </Button>
      }
    >
      {(close) => <PackageForm close={close} />}
    </FormDialog>
  );
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      toolbar={add}
      empty={<EmptyState icon={Package} title="No packages yet" action={add} />}
    />
  );
}
