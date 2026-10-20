"use client";

import { MailPlus, UserPlus, Users } from "lucide-react";
import type { OrgRole } from "@/lib/auth/permissions";
import { removeTeamRole, resendTeamInvite } from "@/lib/actions/team";
import { dataTableColumns } from "@/lib/data-table";
import { formatDay } from "@/lib/time";
import { useServerAction } from "@/lib/use-server-action";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { DataTable } from "@/components/app/data-table/DataTable";
import { EmptyState } from "@/components/app/EmptyState";
import { FormDialog } from "@/components/app/FormDialog";
import { RowActions, useEntityDialogs } from "@/components/app/RowActions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InviteMemberForm } from "./InviteMemberForm";
import { ROLE_LABEL, ROLE_OPTIONS } from "./roles";

export type MemberRow = {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  roles: OrgRole[];
  pending: boolean;
  joined: string;
};

/** Resend for someone who hasn't signed in, and one Remove per role. */
function MemberActions({ m }: { m: MemberRow }) {
  const dialogs = useEntityDialogs<OrgRole>();
  const resend = useServerAction(resendTeamInvite);
  return (
    <>
      <RowActions
        label={`Actions for ${m.name}`}
        primary={
          m.pending
            ? {
                label: "Resend invite",
                icon: MailPlus,
                onSelect: () => resend.mutate(m.userId),
                disabled: resend.isPending,
              }
            : undefined
        }
        destructive={m.roles.map((role) => ({
          label: `Remove ${ROLE_LABEL[role]}`,
          onSelect: dialogs.show(role),
        }))}
      />
      {m.roles.map((role) => (
        <ConfirmAction
          key={role}
          {...dialogs.props(role)}
          title={`Remove ${ROLE_LABEL[role]} from ${m.name}?`}
          description={`${m.name} loses what the ${ROLE_LABEL[role]} role allows. If it is their only role, they leave the organization.`}
          confirmLabel="Remove role"
          onConfirm={() => removeTeamRole(m.id, role)}
        />
      ))}
    </>
  );
}

const col = dataTableColumns<MemberRow>();

const columns = [
  // Name and email in one value, so the search finds either.
  col.accessor((r) => `${r.name} ${r.email ?? ""}`, {
    id: "member",
    header: "Member",
    cell: ({ row }) => (
      <span className="flex flex-col">
        <span
          className={
            row.original.name.includes("@")
              ? "font-semibold [overflow-wrap:anywhere]"
              : "font-semibold"
          }
        >
          {row.original.name}
        </span>
        {row.original.email && row.original.email !== row.original.name ? (
          <span className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
            {row.original.email}
          </span>
        ) : null}
      </span>
    ),
  }),
  col.accessor((r) => r.roles.map((role) => ROLE_LABEL[role]).join(", "), {
    id: "roles",
    header: "Roles",
    enableSorting: false,
    // A member matches a role filter if they hold that role among others.
    filterFn: (row, _id, value) => row.original.roles.includes(value as OrgRole),
    cell: ({ row }) => (
      <span className="flex flex-wrap gap-1">
        {row.original.roles.map((role) => (
          <Badge key={role} variant="outline" className="uppercase tracking-wide">
            {ROLE_LABEL[role]}
          </Badge>
        ))}
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
  col.accessor("joined", {
    header: "Joined",
    meta: { priority: "low" },
    cell: ({ getValue }) => formatDay(getValue()),
  }),
  col.display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    meta: { rowActions: true },
    cell: ({ row }) => <MemberActions m={row.original} />,
  }),
];

export function MembersTable({ rows }: { rows: MemberRow[] }) {
  const invite = (
    <FormDialog
      title="Invite a member"
      description="Someone new gets an email to set their password; someone with an account is given the role and told. To give someone access to a single event, use that event's Staff page."
      trigger={
        <Button>
          <UserPlus aria-hidden /> Invite member
        </Button>
      }
    >
      {(close) => <InviteMemberForm close={close} />}
    </FormDialog>
  );
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      search={{ label: "Search members", placeholder: "Search by name or email…" }}
      filters={[
        { columnId: "roles", label: "Role", allLabel: "All roles", options: ROLE_OPTIONS },
        {
          columnId: "status",
          label: "Status",
          allLabel: "Pending and active",
          options: [
            ["pending", "Pending"],
            ["active", "Active"],
          ],
        },
      ]}
      toolbar={invite}
      empty={<EmptyState icon={Users} title="Nobody in the organization yet" action={invite} />}
    />
  );
}
