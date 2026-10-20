"use client";

import Link from "next/link";
import { Pencil, Plus, Users, UsersRound } from "lucide-react";
import { deleteTeam } from "@/lib/actions/teams";
import { dataTableColumns } from "@/lib/data-table";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { DataTable } from "@/components/app/data-table/DataTable";
import { createTableContext } from "@/components/app/data-table/tableContext";
import { EmptyState } from "@/components/app/EmptyState";
import { FormDialog } from "@/components/app/FormDialog";
import { RowActions, useEntityDialogs } from "@/components/app/RowActions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RosterDialog, type RosterMember, type RosterOption } from "./RosterDialog";
import { type TeamDivision, TeamForm } from "./TeamForm";

export type TeamRow = {
  id: string;
  name: string;
  affiliate: string | null;
  divisionId: string;
  divisionName: string;
  /** The division's athletes per team. */
  size: number | null;
  captainId: string | null;
  roster: RosterMember[];
};

const [TeamsProvider, useTeams] = createTableContext<{
  eventId: string;
  divisions: TeamDivision[];
  available: RosterOption[];
}>("TeamsTable");

const isComplete = (t: TeamRow) => t.size !== null && t.roster.length >= t.size;

function TeamActions({ t }: { t: TeamRow }) {
  const { eventId, divisions, available } = useTeams();
  const dialogs = useEntityDialogs<"roster" | "edit" | "delete">();
  return (
    <>
      <RowActions
        label={`Actions for ${t.name}`}
        primary={{
          label: "Roster",
          ariaLabel: `${t.name} roster`,
          icon: Users,
          onSelect: dialogs.show("roster"),
        }}
        secondary={[{ label: "Edit", icon: Pencil, onSelect: dialogs.show("edit") }]}
        destructive={[{ label: "Delete team", onSelect: dialogs.show("delete") }]}
      />
      <FormDialog
        {...dialogs.props("roster")}
        title={`${t.name} roster`}
        description={`${t.divisionName}${t.size ? ` · ${t.size} per team` : ""}`}
      >
        {() => <RosterDialog eventId={eventId} team={t} available={available} />}
      </FormDialog>
      <FormDialog {...dialogs.props("edit")} title={`Edit ${t.name}`}>
        {(close) => <TeamForm eventId={eventId} divisions={divisions} team={t} close={close} />}
      </FormDialog>
      <ConfirmAction
        {...dialogs.props("delete")}
        title={`Delete ${t.name}?`}
        description="The team, its roster and its registration are deleted. Its athletes stay in the organization. This cannot be undone."
        confirmLabel="Delete team"
        onConfirm={() => deleteTeam(eventId, t.id)}
      />
    </>
  );
}

const col = dataTableColumns<TeamRow>();

const columns = [
  col.accessor((t) => `${t.name} ${t.affiliate ?? ""} ${t.roster.map((m) => m.name).join(" ")}`, {
    id: "team",
    header: "Team",
    cell: ({ row: { original: t } }) => (
      <span className="flex flex-col">
        <span className="font-semibold">{t.name}</span>
        {t.affiliate ? <span className="text-sm text-muted-foreground">{t.affiliate}</span> : null}
      </span>
    ),
  }),
  col.accessor("divisionId", {
    header: "Division",
    filterFn: "equals",
    cell: ({ row }) => row.original.divisionName,
  }),
  col.accessor((t) => (isComplete(t) ? "complete" : "incomplete"), {
    id: "roster",
    header: "Roster",
    filterFn: "equals",
    enableSorting: false,
    cell: ({ row: { original: t } }) => (
      <span className="flex flex-wrap items-center gap-2 tabular-nums">
        {t.roster.length}
        {t.size ? ` / ${t.size}` : ""}
        {isComplete(t) ? null : (
          <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning-text">
            Incomplete
          </Badge>
        )}
      </span>
    ),
  }),
  col.accessor((t) => t.roster.find((m) => m.athleteId === t.captainId)?.name ?? "—", {
    id: "captain",
    header: "Captain",
    meta: { priority: "low" },
    enableSorting: false,
  }),
  col.display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    meta: { rowActions: true },
    cell: ({ row }) => <TeamActions t={row.original} />,
  }),
];

export function TeamsTable({
  eventId,
  rows,
  divisions,
  available,
}: {
  eventId: string;
  rows: TeamRow[];
  divisions: TeamDivision[];
  available: RosterOption[];
}) {
  const add =
    divisions.length > 0 ? (
      <FormDialog
        title="Add team"
        description="The team is registered in its division, so its fee can be recorded under Payments."
        trigger={
          <Button>
            <Plus aria-hidden /> Add team
          </Button>
        }
      >
        {(close) => <TeamForm eventId={eventId} divisions={divisions} close={close} />}
      </FormDialog>
    ) : null;

  return (
    <TeamsProvider value={{ eventId, divisions, available }}>
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(t) => t.id}
        search={{ label: "Search teams", placeholder: "Search teams or athletes…" }}
        filters={[
          {
            columnId: "divisionId",
            label: "Division",
            allLabel: "All divisions",
            options: divisions.map((d) => [d.id, d.name] as [string, string]),
          },
          {
            columnId: "roster",
            label: "Roster",
            allLabel: "Complete and incomplete",
            options: [
              ["complete", "Complete"],
              ["incomplete", "Incomplete"],
            ],
          },
        ]}
        toolbar={add}
        empty={
          add ? (
            <EmptyState icon={UsersRound} title="No teams yet" action={add} />
          ) : (
            <EmptyState
              icon={UsersRound}
              title="Add a team division first."
              description="Teams compete in a division whose format is Pair or Team."
              action={
                <Button asChild variant="outline">
                  <Link href={`/admin/events/${eventId}/divisions`}>Go to Divisions</Link>
                </Button>
              }
            />
          )
        }
      />
    </TeamsProvider>
  );
}
