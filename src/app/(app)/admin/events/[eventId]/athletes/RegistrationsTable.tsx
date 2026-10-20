"use client";

import { UserPlus, Users } from "lucide-react";
import { removeRegistration } from "@/lib/actions/registrations";
import { dataTableColumns } from "@/lib/data-table";
import { AGE_CATEGORY_LABELS, type AgeCategory } from "@/lib/scoring/ageCategory";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { DataTable } from "@/components/app/data-table/DataTable";
import { createTableContext } from "@/components/app/data-table/tableContext";
import { EmptyState } from "@/components/app/EmptyState";
import { FormDialog } from "@/components/app/FormDialog";
import { RowActions, useEntityDialogs } from "@/components/app/RowActions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type Option, RegisterForm } from "./RegisterForm";

export type RegistrationRow = {
  id: string;
  name: string;
  affiliate: string | null;
  /** A team's registration is created and removed with the team, on the Teams page. */
  type: "individual" | "team";
  divisionId: string;
  divisionName: string;
  bib: string | null;
  ageCategory: AgeCategory | null;
};

function RegistrationActions({ r }: { r: RegistrationRow }) {
  const { eventId } = useRegistrations();
  const dialogs = useEntityDialogs<"remove">();
  if (r.type === "team") return null;
  return (
    <>
      <RowActions
        label={`Actions for ${r.name}`}
        destructive={[{ label: "Remove registration", onSelect: dialogs.show("remove") }]}
      />
      <ConfirmAction
        {...dialogs.props("remove")}
        title={`Remove ${r.name} from ${r.divisionName}?`}
        description="Their registration for this event and its payment record are deleted. They stay on your roster and can be registered again."
        confirmLabel="Remove registration"
        onConfirm={() => removeRegistration(eventId, r.id)}
      />
    </>
  );
}

const [RegistrationsProvider, useRegistrations] = createTableContext<{ eventId: string }>(
  "RegistrationsTable",
);

const col = dataTableColumns<RegistrationRow>();
const columns = [
  col.accessor((r) => `${r.name} ${r.affiliate ?? ""} ${r.bib ?? ""}`, {
    id: "competitor",
    header: "Competitor",
    enableSorting: false,
    cell: ({ row }) => (
      <span className="flex flex-col">
        <span className="font-semibold">{row.original.name}</span>
        {row.original.affiliate ? (
          <span className="text-xs text-muted-foreground">{row.original.affiliate}</span>
        ) : null}
      </span>
    ),
  }),
  col.accessor("type", {
    header: "Type",
    enableSorting: false,
    meta: { priority: "low" },
    filterFn: (row, _id, value) =>
      value === "individual"
        ? row.original.type === "individual"
        : row.original.type !== "individual",
    cell: ({ getValue }) =>
      getValue() === "individual" ? (
        "Individual"
      ) : (
        <Badge variant="secondary" className="uppercase">
          {getValue()}
        </Badge>
      ),
  }),
  col.accessor("divisionId", {
    header: "Division",
    enableSorting: false,
    filterFn: "equals",
    cell: ({ row }) => row.original.divisionName,
  }),
  col.accessor((r) => r.bib ?? "", {
    id: "bib",
    header: "Bib",
    enableSorting: false,
    cell: ({ getValue }) =>
      getValue() ? <span className="tabular-nums">#{getValue()}</span> : "—",
  }),
  col.accessor((r) => r.ageCategory ?? "", {
    id: "ageCategory",
    header: "Age category",
    enableSorting: false,
    meta: { priority: "low" },
    cell: ({ row }) =>
      row.original.ageCategory ? (
        <span className="text-xs font-semibold uppercase tracking-wide text-brand-text">
          {AGE_CATEGORY_LABELS[row.original.ageCategory]}
        </span>
      ) : (
        "—"
      ),
  }),
  col.display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    meta: { rowActions: true },
    cell: ({ row }) => <RegistrationActions r={row.original} />,
  }),
];

export function RegistrationsTable({
  eventId,
  rows,
  divisions,
  athletes,
  individualDivisions,
  defaultDivisionId,
}: {
  eventId: string;
  rows: RegistrationRow[];
  divisions: Option[];
  athletes: Option[];
  /** The divisions an athlete can be registered into on their own. */
  individualDivisions: Option[];
  defaultDivisionId: string;
}) {
  const registerAthlete = (
    <FormDialog
      title="Register an athlete"
      trigger={
        <Button>
          <UserPlus aria-hidden /> Register athlete
        </Button>
      }
    >
      {(close) => (
        <RegisterForm
          eventId={eventId}
          athletes={athletes}
          divisions={individualDivisions}
          defaultDivisionId={defaultDivisionId}
          close={close}
        />
      )}
    </FormDialog>
  );
  return (
    <RegistrationsProvider value={{ eventId }}>
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        search={{ label: "Search registrations", placeholder: "Search by name, box or bib…" }}
        filters={[
          {
            columnId: "divisionId",
            label: "Division",
            allLabel: "All divisions",
            options: divisions.map((d) => [d.id, d.label] as const),
          },
          {
            columnId: "type",
            label: "Type",
            allLabel: "Individuals and teams",
            options: [
              ["individual", "Individuals"],
              ["team", "Pairs and teams"],
            ],
          },
        ]}
        toolbar={registerAthlete}
        empty={
          <EmptyState
            icon={Users}
            title="No registrations yet"
            description="Register athletes into this event's individual divisions. Teams are added on the Teams page."
            action={registerAthlete}
          />
        }
      />
    </RegistrationsProvider>
  );
}
