"use client";

import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { createAthlete, deleteAthlete } from "@/lib/actions/athletes";
import { dataTableColumns } from "@/lib/data-table";
import { AGE_CATEGORY_LABELS, type AgeCategory } from "@/lib/scoring/ageCategory";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { DataTable } from "@/components/app/data-table/DataTable";
import { EmptyState } from "@/components/app/EmptyState";
import { FormDialog } from "@/components/app/FormDialog";
import { RowActions, useEntityDialogs } from "@/components/app/RowActions";
import { Button } from "@/components/ui/button";
import { AthleteForm } from "./AthleteForm";

export type AthleteRow = {
  id: string;
  name: string;
  affiliate: string | null;
  gender: "male" | "female" | null;
  ageCategory: AgeCategory | null;
  photoUrl: string | null;
};

function AthleteActions({ a }: { a: AthleteRow }) {
  const dialogs = useEntityDialogs<"remove">();
  return (
    <>
      <RowActions
        label={`Actions for ${a.name}`}
        primary={{ label: "Open", href: `/admin/athletes/${a.id}` }}
        destructive={[{ label: "Remove athlete", onSelect: dialogs.show("remove") }]}
      />
      <ConfirmAction
        {...dialogs.props("remove")}
        title={`Remove ${a.name}?`}
        description="This deletes the athlete from your roster, with their lifts, benchmarks, registrations and results. This cannot be undone."
        confirmLabel="Remove athlete"
        onConfirm={() => deleteAthlete(a.id)}
      />
    </>
  );
}

const col = dataTableColumns<AthleteRow>();

const columns = [
  col.accessor("name", {
    header: "Athlete",
    cell: ({ row }) => (
      <Link
        href={`/admin/athletes/${row.original.id}`}
        className="flex items-center gap-3 font-semibold hover:underline"
      >
        {row.original.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, not a local/optimizable asset
          <img
            src={row.original.photoUrl}
            alt=""
            className="size-9 shrink-0 rounded-full border border-border object-cover object-top"
          />
        ) : (
          <span className="size-9 shrink-0 rounded-full border border-border bg-muted" />
        )}
        {row.original.name}
      </Link>
    ),
  }),
  col.accessor((r) => r.affiliate ?? "", {
    id: "affiliate",
    header: "Affiliate",
    cell: ({ getValue }) => getValue() || "—",
  }),
  col.accessor((r) => r.ageCategory ?? "none", {
    id: "ageCategory",
    header: "Age category",
    filterFn: "equals",
    cell: ({ row }) =>
      row.original.ageCategory ? (
        <span className="text-xs font-semibold uppercase tracking-wide text-brand-text">
          {AGE_CATEGORY_LABELS[row.original.ageCategory]}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  }),
  col.accessor((r) => r.gender ?? "none", {
    id: "gender",
    header: "Gender",
    filterFn: "equals",
    meta: { priority: "low" },
    cell: ({ row }) =>
      row.original.gender === "male" ? "Male" : row.original.gender === "female" ? "Female" : "—",
  }),
  col.display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    meta: { rowActions: true },
    cell: ({ row }) => <AthleteActions a={row.original} />,
  }),
];

export function AthletesTable({ rows }: { rows: AthleteRow[] }) {
  const add = (
    <FormDialog
      title="Add athlete"
      description="Register them into a division per event from that event's Athletes page."
      trigger={
        <Button>
          <Plus aria-hidden /> Add athlete
        </Button>
      }
    >
      {(close) => (
        <AthleteForm
          action={createAthlete}
          submitLabel="Add athlete"
          pendingLabel="Adding…"
          success="Athlete added"
          close={close}
        />
      )}
    </FormDialog>
  );
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      search={{ label: "Search athletes", placeholder: "Search by name or box…" }}
      filters={[
        {
          columnId: "gender",
          label: "Gender",
          allLabel: "All genders",
          options: [
            ["male", "Male"],
            ["female", "Female"],
            ["none", "Not set"],
          ],
        },
        {
          columnId: "ageCategory",
          label: "Age category",
          allLabel: "All ages",
          options: [
            ...(Object.entries(AGE_CATEGORY_LABELS) as [AgeCategory, string][]),
            ["none", "Open"],
          ],
        },
      ]}
      toolbar={add}
      empty={
        <EmptyState
          icon={Users}
          title="No athletes yet"
          description="Add your first athlete."
          action={add}
        />
      }
    />
  );
}
