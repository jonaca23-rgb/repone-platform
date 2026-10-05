"use client";

import { Users } from "lucide-react";
import { dataTableColumns } from "@/lib/data-table";
import { DataTable } from "@/components/app/data-table/DataTable";
import { EmptyState } from "@/components/app/EmptyState";

export type CommentatorAthleteRow = {
  id: string;
  name: string;
  /** "Last First", so the default order matches the roster. */
  sortName: string;
  bib: string | null;
  division: string;
  affiliate: string | null;
};

const col = dataTableColumns<CommentatorAthleteRow>();
const columns = [
  col.accessor((r) => `${r.sortName} ${r.name}`, {
    id: "athlete",
    header: "Athlete",
    // Spanish order: "Álvarez" sorts with the A's, not after "Zayas".
    sortFn: (a, b) =>
      a.original.sortName.localeCompare(b.original.sortName, "es", { sensitivity: "base" }),
    cell: ({ row }) => <span className="font-semibold">{row.original.name}</span>,
  }),
  col.accessor((r) => r.bib ?? "", {
    id: "bib",
    header: "Bib",
    enableSorting: false,
    meta: { priority: "low" },
    cell: ({ getValue }) =>
      getValue() ? <span className="tabular-nums">#{getValue()}</span> : "—",
  }),
  col.accessor("division", { header: "Division", enableSorting: false, filterFn: "equals" }),
  col.accessor((r) => r.affiliate ?? "", {
    id: "affiliate",
    header: "Affiliate",
    enableSorting: false,
    meta: { priority: "low" },
    cell: ({ getValue }) => getValue() || "—",
  }),
];

export function CommentatorAthletesTable({
  rows,
  divisions,
}: {
  rows: CommentatorAthleteRow[];
  divisions: string[];
}) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      search={{ label: "Search athletes", placeholder: "Search by name, bib or affiliate…" }}
      initialSorting={[{ id: "athlete", desc: false }]}
      filters={[
        {
          columnId: "division",
          label: "Division",
          allLabel: "All divisions",
          options: divisions.map((d) => [d, d] as const),
        },
      ]}
      empty={<EmptyState icon={Users} title="No athletes registered for this event yet" />}
    />
  );
}
