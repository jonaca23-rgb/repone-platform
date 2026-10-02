"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { NotAuthorizedError, requireOrgManager } from "@/lib/auth/guards";
import { InviteError, inviteToOrg, pendingEmail } from "@/lib/auth/invite";
import { ORG_ROLES, splitRoles, type OrgRole } from "@/lib/auth/permissions";
import { orgCan } from "@/lib/auth/session";
import { failure, inviteMessage, resendMessage, type FormResult } from "@/lib/actions/inviteResult";
import { createClient } from "@/lib/db/server";
import { field, parseArg, parseForm } from "@/lib/validation/form";

// The Team page (/admin/team): org roles for the one organization. Only an
// owner or admin (member:create) may use it; BetterAuth applies its own rules
// again wherever the call carries the caller's headers (updateMemberRole,
// removeMember). See lib/auth/invite.ts for how an invitation works.

/** Every org role except owner: ownership is not granted here, nor transferable in the app yet (a manual SQL step). */
const INVITABLE_ROLES = ORG_ROLES.filter((r) => r !== "owner") as [OrgRole, ...OrgRole[]];

const InviteForm = z.object({
  email: field.email(),
  role: field.oneOf(INVITABLE_ROLES, "role"),
});

async function requireTeamManager() {
  const { ctx, organizationId } = await requireOrgManager();
  if (!orgCan(ctx, { member: ["create"] }))
    throw new NotAuthorizedError("Only an owner or admin can manage the team.");
  return { ctx, organizationId };
}

export async function inviteTeamMember(
  _previous: FormResult,
  formData: FormData,
): Promise<FormResult> {
  try {
    const { email, role } = parseForm(InviteForm, formData);
    const { organizationId } = await requireTeamManager();
    const supabase = await createClient();
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .single();
    const outcome = await inviteToOrg({
      email,
      role,
      organizationId,
      orgName: org?.name ?? "RepOne",
      headers: await headers(),
    });
    revalidatePath("/admin/team");
    return inviteMessage(outcome);
  } catch (error) {
    return failure(error);
  }
}

export async function resendTeamInvite(userId: string, _previous: FormResult): Promise<FormResult> {
  try {
    const id = parseArg(field.id("Person"), userId);
    const { organizationId } = await requireTeamManager();
    // Only someone in this organization (RLS lets managers read its members).
    const supabase = await createClient();
    const { data: row } = await supabase
      .from("member")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", id)
      .maybeSingle();
    if (!row) throw new InviteError("That person isn't on this team.");
    const email = await pendingEmail(id);
    if (!email) throw new InviteError("They have already signed in; there's nothing to resend.");
    return await resendMessage(id, email);
  } catch (error) {
    return failure(error);
  }
}

export async function removeTeamRole(
  memberId: string,
  role: string,
  _previous: FormResult,
): Promise<FormResult> {
  try {
    const id = parseArg(field.id("Member"), memberId);
    const dropped = parseArg(field.oneOf(ORG_ROLES as [OrgRole, ...OrgRole[]], "role"), role);
    const { organizationId } = await requireTeamManager();
    const supabase = await createClient();
    const { data: row } = await supabase
      .from("member")
      .select("role")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!row) throw new InviteError("That person isn't on this team.");

    const remaining = splitRoles(row.role).filter((r) => r !== dropped);
    const requestHeaders = await headers();
    if (remaining.length) {
      await auth.api.updateMemberRole({
        headers: requestHeaders,
        body: { memberId: id, role: remaining, organizationId },
      });
    } else {
      await auth.api.removeMember({
        headers: requestHeaders,
        body: { memberIdOrEmail: id, organizationId },
      });
    }
    revalidatePath("/admin/team");
    return { ok: true, message: remaining.length ? "Role removed." : "Removed from the team." };
  } catch (error) {
    return failure(error);
  }
}
