"use client";

import { Plus, UserPlus, UsersRound, X } from "lucide-react";
import type { EntryFormat } from "@/lib/db/database.types";
import { deleteTeam, removeTeamMember } from "@/lib/actions/teams";
import { dataTableColumns } from "@/lib/data-table";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { DataTable } from "@/components/app/data-table/DataTable";
import { EmptyState } from "@/components/app/EmptyState";
import { FormDialog } from "@/components/app/FormDialog";
import { RowActions, useEntityDialogs } from "@/components/app/RowActions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddRosterMemberForm, type RosterOption } from "./AddRosterMemberForm";
import { ENTRY_FORMAT_LABELS, ENTRY_FORMAT_OPTIONS } from "./formats";
import { TeamForm } from "./TeamForm";

export type TeamRow = {
  id: string;
  name: string;
  affiliate: string | null;
  format: EntryFormat;
  size: number | null;
  roster: { memberId: string; name: string }[];
  /** Roster athletes not on this team yet, for "Add to roster". */
  available: RosterOption[];
};

/** The roster as badges, each with its own Remove that asks first. */
function Roster({ t }: { t: TeamRow }) {
  const dialogs = useEntityDialogs<string>();
  if (t.roster.length === 0) return <span className="text-muted-foreground">No one yet</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {t.roster.map((m) => (
        <Badge key={m.memberId} variant="outline" className="h-auto gap-0 py-0 pr-0">
          {m.name}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={dialogs.show(m.memberId)}
            aria-label={`Remove ${m.name} from ${t.name}`}
          >
            <X aria-hidden />
          </Button>
          <ConfirmAction
            {...dialogs.props(m.memberId)}
            title={`Remove ${m.name} from ${t.name}?`}
            description="They come off this team's roster. They stay on your athlete roster and can be added back."
            confirmLabel="Remove from roster"
            onConfirm={() => removeTeamMember(m.memberId)}
          />
        </Badge>
      ))}
    </span>
  );
}

function TeamActions({ t }: { t: TeamRow }) {
  const dialogs = useEntityDialogs<"add" | "delete">();
  const full = t.available.length === 0;
  return (
    <>
      <RowActions
        label={`Actions for ${t.name}`}
        primary={{
          label: "Add to roster",
          icon: UserPlus,
          onSelect: dialogs.show("add"),
          disabled: full,
          hint: full ? "Everyone on your roster is on this team" : undefined,
        }}
        destructive={[{ label: "Delete team", onSelect: dialogs.show("delete") }]}
      />
      <FormDialog title={`Add to ${t.name}`} {...dialogs.props("add")}>
        {(close) => <AddRosterMemberForm teamId={t.id} athletes={t.available} close={close} />}
      </FormDialog>
      <ConfirmAction
        {...dialogs.props("delete")}
        title={`Delete ${t.name}?`}
        description="The team and its roster are deleted, along with its registrations and results. The athletes stay on your roster. This cannot be undone."
        confirmLabel="Delete team"
        onConfirm={() => deleteTeam(t.id)}
      />
    </>
  );
}

const col = dataTableColumns<TeamRow>();

const columns = [
  col.accessor((r) => `${r.name} ${r.affiliate ?? ""} ${r.roster.map((m) => m.name).join(" ")}`, {
    id: "team",
    header: "Team",
    cell: ({ row }) => (
      <span className="flex flex-col">
        <span className="font-semibold">{row.original.name}</span>
        {row.original.affiliate ? (
          <span className="text-xs text-muted-foreground">{row.original.affiliate}</span>
        ) : null}
      </span>
    ),
  }),
  col.accessor("format", {
    header: "Format",
    filterFn: "equals",
    cell: ({ getValue }) => ENTRY_FORMAT_LABELS[getValue()],
  }),
  col.display({ id: "roster", header: "Roster", cell: ({ row }) => <Roster t={row.original} /> }),
  col.accessor((r) => r.roster.length, {
    id: "spots",
    header: "Spots",
    meta: { priority: "low" },
    cell: ({ row }) => (
      <span className="tabular-nums">
        {row.original.roster.length}
        {row.original.size ? ` / ${row.original.size}` : ""}
      </span>
    ),
  }),
  col.display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    meta: { rowActions: true },
    cell: ({ row }) => <TeamActions t={row.original} />,
  }),
];

export function TeamsTable({ rows }: { rows: TeamRow[] }) {
  const create = (
    <FormDialog
      title="New team"
      description="Pairs, teams or any custom format built from athletes on your roster."
      trigger={
        <Button>
          <Plus aria-hidden /> New team
        </Button>
      }
    >
      {(close) => <TeamForm close={close} />}
    </FormDialog>
  );
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      search={{ label: "Search teams", placeholder: "Search teams or athletes…" }}
      filters={[
        {
          columnId: "format",
          label: "Format",
          allLabel: "All formats",
          options: ENTRY_FORMAT_OPTIONS,
        },
      ]}
      toolbar={create}
      empty={
        <EmptyState
          icon={UsersRound}
          title="No teams yet"
          description="Create your first team."
          action={create}
        />
      }
    />
  );
}
