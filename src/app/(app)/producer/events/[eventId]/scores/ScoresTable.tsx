"use client";

import { ClipboardList, PencilLine } from "lucide-react";
import { dataTableColumns } from "@/lib/data-table";
import { DataTable } from "@/components/app/data-table/DataTable";
import { EmptyState } from "@/components/app/EmptyState";
import { RowActions } from "@/components/app/RowActions";
import { Badge } from "@/components/ui/badge";

export type ScoreRow = {
  id: string;
  competitor: string;
  wodName: string;
  heatNumber: number;
  divisionName: string;
  /** The result in one line, from scoreSummary: "03:45", "CAP 87", "DNF". */
  score: string;
  status: string;
  adjusted: boolean;
  floorId: string;
};

const STATUS_STYLE: Record<string, string> = {
  completed: "border-success/40 bg-success/10 text-success-text",
};
const OTHER_STATUS = "border-warning/40 bg-warning/10 text-warning-text";

function CorrectAction({ r }: { r: ScoreRow }) {
  return (
    <RowActions
      label={`Actions for ${r.competitor}'s result`}
      secondary={[
        {
          label: "Correct on Score Keeper",
          icon: PencilLine,
          href: `/scorekeeper/${r.floorId}`,
        },
      ]}
    />
  );
}

const col = dataTableColumns<ScoreRow>();
const columns = [
  col.accessor("competitor", {
    header: "Competitor",
    cell: ({ getValue }) => <span className="font-semibold">{getValue()}</span>,
  }),
  col.accessor("wodName", {
    header: "WOD",
    filterFn: "equals",
    meta: { priority: "low" },
  }),
  col.accessor("heatNumber", {
    header: "Heat",
    cell: ({ getValue }) => <span className="tabular-nums">Heat {getValue()}</span>,
  }),
  col.accessor("divisionName", {
    header: "Division",
    enableSorting: false,
    filterFn: "equals",
    meta: { priority: "low" },
  }),
  col.accessor("score", {
    header: "Score",
    enableSorting: false,
    cell: ({ getValue }) => (
      <span className="font-display text-base tabular-nums">{getValue()}</span>
    ),
  }),
  col.accessor("status", {
    header: "Status",
    filterFn: "equals",
    cell: ({ row }) => (
      <span className="flex flex-wrap gap-1.5">
        <Badge
          variant="outline"
          className={`uppercase ${STATUS_STYLE[row.original.status] ?? OTHER_STATUS}`}
        >
          {row.original.status}
        </Badge>
        {row.original.adjusted ? <Badge variant="secondary">Adjusted</Badge> : null}
      </span>
    ),
  }),
  col.display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    meta: { rowActions: true },
    cell: ({ row }) => <CorrectAction r={row.original} />,
  }),
];

export function ScoresTable({
  rows,
  wods,
  divisions,
}: {
  rows: ScoreRow[];
  wods: string[];
  divisions: string[];
}) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      search={{ label: "Search scores", placeholder: "Search by athlete or team…" }}
      initialSorting={[
        { id: "wodName", desc: false },
        { id: "heatNumber", desc: false },
      ]}
      filters={[
        {
          columnId: "status",
          label: "Status",
          allLabel: "All statuses",
          options: [
            ["completed", "Completed"],
            ["dnf", "DNF"],
            ["dns", "DNS"],
            ["dq", "DQ"],
          ],
        },
        {
          columnId: "wodName",
          label: "WOD",
          allLabel: "All WODs",
          options: wods.map((w) => [w, w] as const),
        },
        {
          columnId: "divisionName",
          label: "Division",
          allLabel: "All divisions",
          options: divisions.map((d) => [d, d] as const),
        },
      ]}
      empty={<EmptyState icon={ClipboardList} title="No scores recorded for this event yet" />}
    />
  );
}
