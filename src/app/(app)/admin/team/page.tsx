import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionContext, orgCan } from "@/lib/auth/session";
import { splitRoles } from "@/lib/auth/permissions";
import { createClient } from "@/lib/db/server";
import { PageHeader } from "@/components/app/PageHeader";
import { type MemberRow, MembersTable } from "./MembersTable";

export const metadata: Metadata = { title: "Members" };

/**
 * The organization's members: who holds which org role, who has yet to accept
 * their invitation, and the invite dialog. Owners and admins only
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
  const rows: MemberRow[] = (members ?? []).map((m) => {
    const account = accountById.get(m.user_id);
    return {
      id: m.id,
      userId: m.user_id,
      name: nameById.get(m.user_id) || account?.email || "Unknown account",
      email: account?.email ?? null,
      roles: splitRoles(m.role),
      pending: !!account && account.last_sign_in_at === null,
      joined: m.created_at.slice(0, 10),
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Members"
        description="Who holds which role in the organization. Invite people by email and choose their role."
      />
      <MembersTable rows={rows} />
    </div>
  );
}
