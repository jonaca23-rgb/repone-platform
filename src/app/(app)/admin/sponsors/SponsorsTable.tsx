"use client";

import { BadgeDollarSign, Plus } from "lucide-react";
import type { SponsorTier } from "@/lib/db/database.types";
import { toggleSponsorActive } from "@/lib/actions/sponsors";
import { dataTableColumns } from "@/lib/data-table";
import { ActionSwitch } from "@/components/app/ActionSwitch";
import { DataTable } from "@/components/app/data-table/DataTable";
import { EmptyState } from "@/components/app/EmptyState";
import { FormDialog } from "@/components/app/FormDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SponsorForm } from "./SponsorForm";
import { TIER_LABELS, TIER_OPTIONS } from "./tiers";

export type SponsorRow = {
  id: string;
  business_name: string;
  tier: SponsorTier;
  category: string | null;
  category_exclusive: boolean;
  active: boolean;
  eventName: string;
};

const col = dataTableColumns<SponsorRow>();

const columns = [
  col.accessor("business_name", {
    header: "Sponsor",
    cell: ({ row }) => (
      <span className="flex flex-wrap items-center gap-2 font-semibold">
        {row.original.business_name}
        {row.original.category_exclusive ? (
          <Badge variant="outline" className="h-auto whitespace-normal uppercase text-brand-text">
            Exclusive · {row.original.category}
          </Badge>
        ) : null}
      </span>
    ),
  }),
  col.accessor("tier", {
    header: "Tier",
    filterFn: "equals",
    cell: ({ getValue }) => TIER_LABELS[getValue()],
  }),
  col.accessor("category", {
    header: "Category",
    meta: { priority: "low" },
    cell: ({ getValue }) => getValue() ?? "—",
  }),
  col.accessor("eventName", { header: "Event", meta: { priority: "low" } }),
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
];

export function SponsorsTable({
  rows,
  events,
}: {
  rows: SponsorRow[];
  events: { id: string; name: string }[];
}) {
  const add = (
    <FormDialog
      title="Add sponsor"
      description='Category-exclusive sponsors (e.g. "Official Physical Therapy Partner") are enforced per event.'
      trigger={
        <Button>
          <Plus aria-hidden /> Add sponsor
        </Button>
      }
    >
      {(close) => <SponsorForm events={events} close={close} />}
    </FormDialog>
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      search={{ label: "Search sponsors", placeholder: "Search sponsors…" }}
      filters={[
        { columnId: "tier", label: "Tier", allLabel: "All tiers", options: TIER_OPTIONS },
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
