import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { X } from "lucide-react";
import { getSessionContext, orgCan } from "@/lib/auth/session";
import { ORG_ROLES, splitRoles, type OrgRole } from "@/lib/auth/permissions";
import { createClient } from "@/lib/db/server";
import {
  ConfirmFormResultAction,
  InlineActionButton,
  InviteByEmailForm,
} from "@/components/InviteForms";
import { inviteTeamMember, removeTeamRole, resendTeamInvite } from "@/lib/actions/team";
import { PageHeader } from "@/components/app/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Members" };

const ROLE_LABEL: Record<OrgRole, string> = {
  owner: "Owner",
  admin: "Admin",
  event_director: "Event director",
  production_director: "Production director",
  scoring_operator: "Scoring operator",
  commentator: "Commentator",
};

/** Owner is never granted by invitation; ownership is not transferable in the app yet (lib/actions/team.ts). */
const INVITABLE = ORG_ROLES.filter((r) => r !== "owner").map((r) => ({
  value: r,
  label: ROLE_LABEL[r],
}));

/**
 * The organization's members: who holds which org role, who has yet to accept
 * their invitation, and the invite form. Owners and admins only
 * (member:create); per-event staff are invited from each event's Staff tab.
 * Called "Members" in the UI; the route stays /admin/team.
 */
export default async function TeamPage() {
  const ctx = await getSessionContext();
  if (!orgCan(ctx, { member: ["create"] })) redirect("/admin");
  const organizationId = ctx!.organizationId!;
  const supabase = await createClient();

  // member and profiles through RLS (members read their org's members and
  // names); emails and first sign-in through org_member_emails (0030), since
  // public."user" is closed to the API.
  const [{ data: members }, { data: emails }] = await Promise.all([
    supabase
      .from("member")
      .select("id, user_id, role, created_at")
      .eq("organization_id", organizationId)
      .order("created_at"),
    supabase.rpc("org_member_emails", { p_organization_id: organizationId }),
  ]);
  const userIds = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [] };

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const accountById = new Map((emails ?? []).map((e) => [e.user_id, e]));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Members"
        description="Invite people by email and choose their role in the organization. Someone new gets an email to set their password; someone with an account is given the role and told."
      />

      <Card>
        <CardHeader>
          <CardTitle>Invite a member</CardTitle>
          <CardDescription>
            To give someone access to a single event, use that event&apos;s Staff page instead.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteByEmailForm action={inviteTeamMember} roles={INVITABLE} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(members ?? []).map((m) => {
            const account = accountById.get(m.user_id);
            const name = nameById.get(m.user_id) || account?.email || "Unknown account";
            const pending = !!account && account.last_sign_in_at === null;
            return (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-4 py-2"
              >
                <span className="flex flex-col">
                  <span className="font-semibold">{name}</span>
                  {account?.email && account.email !== name ? (
                    <span className="text-xs text-muted-foreground">{account.email}</span>
                  ) : null}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {splitRoles(m.role).map((role) => (
                    <Badge
                      key={role}
                      variant="outline"
                      className="h-auto gap-0 py-0 pr-0 uppercase tracking-wide"
                    >
                      {ROLE_LABEL[role]}
                      <ConfirmFormResultAction
                        action={removeTeamRole.bind(null, m.id, role)}
                        trigger={
                          <>
                            <X aria-hidden />
                            <span className="sr-only">
                              Remove {ROLE_LABEL[role]} from {name}
                            </span>
                          </>
                        }
                        title={`Remove ${ROLE_LABEL[role]} from ${name}?`}
                        description={`${name} loses what the ${ROLE_LABEL[role]} role allows. If it is their only role, they leave the organization.`}
                        confirmLabel="Remove role"
                      />
                    </Badge>
                  ))}
                  {pending && (
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      Pending ·
                      <InlineActionButton
                        action={resendTeamInvite.bind(null, m.user_id)}
                        label="Resend"
                      />
                    </span>
                  )}
                </span>
              </div>
            );
          })}
          {(members ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Nobody in the organization yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
