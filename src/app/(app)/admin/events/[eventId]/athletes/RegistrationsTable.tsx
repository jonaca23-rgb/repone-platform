"use client";

import { UserPlus, Users, UsersRound } from "lucide-react";
import { removeRegistration } from "@/lib/actions/registrations";
import { dataTableColumns } from "@/lib/data-table";
import { AGE_CATEGORY_LABELS, type AgeCategory } from "@/lib/scoring/ageCategory";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { DataTable } from "@/components/app/data-table/DataTable";
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
  /** "individual", or the team's entry format. */
  type: string;
  divisionId: string;
  divisionName: string;
  bib: string | null;
  ageCategory: AgeCategory | null;
};

function RegistrationActions({ eventId, r }: { eventId: string; r: RegistrationRow }) {
  const dialogs = useEntityDialogs<"remove">();
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

export function RegistrationsTable({
  eventId,
  rows,
  divisions,
  athletes,
  teams,
  defaultDivisionId,
}: {
  eventId: string;
  rows: RegistrationRow[];
  divisions: Option[];
  athletes: Option[];
  teams: Option[];
  defaultDivisionId: string;
}) {
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
      cell: ({ row }) => <RegistrationActions eventId={eventId} r={row.original} />,
    }),
  ];
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
          kind="athlete"
          eventId={eventId}
          competitors={athletes}
          divisions={divisions}
          defaultDivisionId={defaultDivisionId}
          close={close}
        />
      )}
    </FormDialog>
  );
  const registerTeam = (
    <FormDialog
      title="Register a pair, team or custom entry"
      trigger={
        <Button variant="outline">
          <UsersRound aria-hidden /> Register team
        </Button>
      }
    >
      {(close) => (
        <RegisterForm
          kind="team"
          eventId={eventId}
          competitors={teams}
          divisions={divisions}
          defaultDivisionId={defaultDivisionId}
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
            ["team", "Pairs, teams and custom"],
          ],
        },
      ]}
      toolbar={
        <>
          {registerAthlete}
          {registerTeam}
        </>
      }
      empty={
        <EmptyState
          icon={Users}
          title="No registrations yet"
          description="Register athletes and teams into this event's divisions."
          action={
            <span className="flex flex-wrap justify-center gap-2">
              {registerAthlete}
              {registerTeam}
            </span>
          }
        />
      }
    />
  );
}
