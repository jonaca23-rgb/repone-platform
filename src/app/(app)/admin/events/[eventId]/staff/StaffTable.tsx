"use client";

import { MailPlus, UserPlus, UsersRound } from "lucide-react";
import {
  removeEventCommentator,
  removeEventProducer,
  removeEventScorekeeper,
  resendEventInvite,
} from "@/lib/actions/eventStaff";
import { dataTableColumns } from "@/lib/data-table";
import { useServerAction } from "@/lib/use-server-action";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { DataTable } from "@/components/app/data-table/DataTable";
import { EmptyState } from "@/components/app/EmptyState";
import { FormDialog } from "@/components/app/FormDialog";
import { RowActions, useEntityDialogs } from "@/components/app/RowActions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InviteStaffForm } from "./InviteStaffForm";
import { STAFF_ROLE_LABEL, STAFF_ROLE_OPTIONS, type StaffRole } from "./staffRoles";

export type StaffRow = {
  /** The assignment's id: one person can hold several roles, one row each. */
  id: string;
  userId: string;
  role: StaffRole;
  name: string;
  email: string | null;
  roleLabel: string | null;
  pending: boolean;
};

const REMOVE = {
  scorekeeper: removeEventScorekeeper,
  producer: removeEventProducer,
  commentator: removeEventCommentator,
} as const;

function StaffActions({
  eventId,
  eventName,
  s,
}: {
  eventId: string;
  eventName: string;
  s: StaffRow;
}) {
  const dialogs = useEntityDialogs<"remove">();
  const resend = useServerAction((userId: string) => resendEventInvite(eventId, userId));
  return (
    <>
      <RowActions
        label={`Actions for ${s.name}, ${STAFF_ROLE_LABEL[s.role]}`}
        primary={
          s.pending
            ? {
                label: "Resend invite",
                icon: MailPlus,
                onSelect: () => resend.mutate(s.userId),
                disabled: resend.isPending,
              }
            : undefined
        }
        destructive={[{ label: "Remove from event", onSelect: dialogs.show("remove") }]}
      />
      <ConfirmAction
        {...dialogs.props("remove")}
        title={`Remove ${s.name} from ${eventName}?`}
        description={`${s.name} loses ${STAFF_ROLE_LABEL[s.role].toLowerCase()} access to this event. You can invite them again later.`}
        confirmLabel="Remove"
        onConfirm={() => REMOVE[s.role](eventId, s.id)}
      />
    </>
  );
}

export function StaffTable({
  eventId,
  eventName,
  rows,
}: {
  eventId: string;
  eventName: string;
  rows: StaffRow[];
}) {
  const col = dataTableColumns<StaffRow>();
  const columns = [
    col.accessor((r) => `${r.name} ${r.email ?? ""}`, {
      id: "person",
      header: "Name",
      cell: ({ row }) => (
        <span className="flex flex-col">
          <span className="font-semibold">{row.original.name}</span>
          {row.original.email && row.original.email !== row.original.name ? (
            <span className="text-xs text-muted-foreground">{row.original.email}</span>
          ) : null}
        </span>
      ),
    }),
    col.accessor("role", {
      header: "Role",
      filterFn: "equals",
      cell: ({ row }) => (
        <span className="flex flex-col">
          {STAFF_ROLE_LABEL[row.original.role]}
          {row.original.roleLabel ? (
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {row.original.roleLabel.replace(/_/g, " ")}
            </span>
          ) : null}
        </span>
      ),
    }),
    col.accessor((r) => (r.pending ? "pending" : "active"), {
      id: "status",
      header: "Status",
      filterFn: "equals",
      cell: ({ getValue }) =>
        getValue() === "pending" ? (
          <Badge variant="outline" className="text-warning-text">
            Pending
          </Badge>
        ) : (
          <span className="text-muted-foreground">Active</span>
        ),
    }),
    col.display({
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      meta: { rowActions: true },
      cell: ({ row }) => <StaffActions eventId={eventId} eventName={eventName} s={row.original} />,
    }),
  ];
  const invite = (
    <FormDialog
      title="Invite staff"
      description={`Each role only gets access to ${eventName}. Someone new gets an email to set their password; someone with an account is given access and told.`}
      trigger={
        <Button>
          <UserPlus aria-hidden /> Invite staff
        </Button>
      }
    >
      {(close) => <InviteStaffForm eventId={eventId} close={close} />}
    </FormDialog>
  );
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => `${r.role}-${r.id}`}
      search={{ label: "Search staff", placeholder: "Search by name or email…" }}
      filters={[
        { columnId: "role", label: "Role", allLabel: "All roles", options: STAFF_ROLE_OPTIONS },
      ]}
      toolbar={invite}
      empty={
        <EmptyState
          icon={UsersRound}
          title="Nobody assigned yet"
          description="Invite scorekeepers, producers and commentators for this event."
          action={invite}
        />
      }
    />
  );
}
