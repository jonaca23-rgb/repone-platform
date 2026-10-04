"use client";

import Link from "next/link";
import { Medal } from "lucide-react";
import { dataTableColumns } from "@/lib/data-table";
import { DataTable } from "@/components/app/data-table/DataTable";
import { EmptyState } from "@/components/app/EmptyState";
import { Badge } from "@/components/ui/badge";

export type CompetitionRow = {
  eventId: string;
  eventName: string;
  divisionName: string;
  placement: number | null;
  points: number | null;
  wods: { wodId: string; name: string; placement: number | null }[];
};

const col = dataTableColumns<CompetitionRow>();
const columns = [
  col.accessor("eventName", {
    header: "Event",
    enableSorting: false,
    cell: ({ row }) => (
      <Link
        href={`/admin/events/${row.original.eventId}`}
        className="font-semibold hover:underline"
      >
        {row.original.eventName}
      </Link>
    ),
  }),
  col.accessor("divisionName", { header: "Division", enableSorting: false }),
  col.accessor((r) => r.placement ?? Number.MAX_SAFE_INTEGER, {
    id: "overall",
    header: "Overall",
    cell: ({ row }) =>
      row.original.placement ? (
        <span className="tabular-nums">#{row.original.placement}</span>
      ) : (
        "—"
      ),
  }),
  col.accessor((r) => r.points ?? 0, {
    id: "points",
    header: "Points",
    meta: { priority: "low" },
    cell: ({ row }) =>
      row.original.points !== null ? (
        <span className="tabular-nums">{row.original.points} pts</span>
      ) : (
        "—"
      ),
  }),
  col.display({
    id: "wods",
    header: "By WOD",
    meta: { priority: "low" },
    cell: ({ row }) => (
      <span className="flex flex-wrap gap-1">
        {row.original.wods.map((w) => (
          <Badge key={w.wodId} variant="secondary">
            {w.name}: {w.placement ? `#${w.placement}` : "—"}
          </Badge>
        ))}
      </span>
    ),
  }),
];

/** Every event the athlete has a standing in, newest first. */
export function CompetitionsTable({ rows }: { rows: CompetitionRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.eventId}
      empty={<EmptyState icon={Medal} title="No competition results yet" />}
    />
  );
}
