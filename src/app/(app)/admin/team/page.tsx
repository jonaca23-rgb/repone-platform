import { redirect } from "next/navigation";
import { getSessionContext, orgCan } from "@/lib/auth/session";
import { ORG_ROLES, splitRoles, type OrgRole } from "@/lib/auth/permissions";
import { createClient } from "@/lib/db/server";
import { InlineActionButton, InviteByEmailForm } from "@/components/InviteForms";
import { inviteTeamMember, removeTeamRole, resendTeamInvite } from "@/lib/actions/team";

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
 * The organization's team: who holds which org role, who has yet to accept
 * their invitation, and the invite form. Owners and admins only
 * (member:create); per-event staff are invited from each event's Staff tab.
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
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Team</h1>
        <p className="text-sm text-black/50">
          Invite people by email and choose their role in the organization. Someone new gets an
          email to set their password; someone with an account is given the role and told.
        </p>
      </div>

      <section className="rounded-xl border border-black/10 p-5">
        <h2 className="text-lg font-bold">Invite to the team</h2>
        <p className="mb-4 text-sm text-black/50">
          To give someone access to a single event, use that event&apos;s Staff tab instead.
        </p>
        <InviteByEmailForm action={inviteTeamMember} roles={INVITABLE} />
      </section>

      <section className="rounded-xl border border-black/10 p-5">
        <h2 className="mb-4 text-lg font-bold">Members</h2>
        <div className="flex flex-col gap-2">
          {(members ?? []).map((m) => {
            const account = accountById.get(m.user_id);
            const name = nameById.get(m.user_id) || account?.email || "Unknown account";
            const pending = !!account && account.last_sign_in_at === null;
            return (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-black/5 px-4 py-2"
              >
                <span className="flex flex-col">
                  <span className="font-semibold">{name}</span>
                  {account?.email && account.email !== name ? (
                    <span className="text-xs text-black/50">{account.email}</span>
                  ) : null}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {splitRoles(m.role).map((role) => (
                    <span
                      key={role}
                      className="inline-flex items-center gap-1 rounded-full bg-black/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                    >
                      {ROLE_LABEL[role]}
                      <InlineActionButton
                        action={removeTeamRole.bind(null, m.id, role)}
                        label="×"
                        ariaLabel={`Remove ${ROLE_LABEL[role]} from ${name}`}
                        className="text-sm text-repone-red hover:opacity-70"
                      />
                    </span>
                  ))}
                  {pending && (
                    <span className="flex items-center gap-2 text-sm text-black/50">
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
            <p className="text-sm text-black/40">Nobody on the team yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
