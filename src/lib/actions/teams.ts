"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { expectChanged, requireOrgManager } from "@/lib/auth/guards";
import { createClient } from "@/lib/db/server";
import { Constants } from "@/lib/db/supabase.types";
import { field, parseForm } from "@/lib/validation/form";
import { safeAction } from "./safeAction";

const TeamForm = z.object({
  name: field.text("Team name", { max: 200 }),
  affiliate: field.optionalText({ max: 200, label: "Affiliate" }),
  entry_format: field.oneOf(Constants.public.Enums.entry_format, "entry format").default("team"),
  team_size: field
    .optionalNumber("Headcount", { min: 1, max: 100 })
    .refine((n) => n === null || Number.isInteger(n), "Headcount must be a whole number."),
});

const TeamMemberForm = z.object({
  athlete_id: z.guid({ error: "Choose an athlete to add." }),
});

/**
 * Teams have existed in the schema since 0001_init.sql (referenced by
 * lanes/results/registrations) but had no UI at all until this module —
 * flagged as a gap in the Requirements Audit. `team_size` here is purely
 * informational for display and fee-matching; it is never a constraint, per
 * the product rule that no fixed roster size (e.g. "teams of 3") is assumed.
 */
export async function createTeam(formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { organizationId } = await requireOrgManager();
    const f = parseForm(TeamForm, formData);

    const supabase = await createClient();
    const { error } = await supabase
      .from("teams")
      .insert({ organization_id: organizationId, ...f });
    if (error) throw new Error(error.message);

    revalidatePath("/admin/teams");
    return ok();
  });
}

export async function deleteTeam(teamId: string): Promise<ActionResult> {
  return safeAction(async () => {
    const { organizationId } = await requireOrgManager();
    const supabase = await createClient();
    expectChanged(
      await supabase
        .from("teams")
        .delete()
        .eq("id", teamId)
        .eq("organization_id", organizationId)
        .select("id"),
      "delete the team",
    );
    revalidatePath("/admin/teams");
    return ok();
  });
}

export async function addTeamMember(teamId: string, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { organizationId } = await requireOrgManager();
    const { athlete_id } = parseForm(TeamMemberForm, formData);

    const supabase = await createClient();
    const [{ data: team, error: teamError }, { data: athlete, error: athleteError }] =
      await Promise.all([
        supabase
          .from("teams")
          .select("id")
          .eq("id", teamId)
          .eq("organization_id", organizationId)
          .maybeSingle(),
        supabase
          .from("athletes")
          .select("id")
          .eq("id", athlete_id)
          .eq("organization_id", organizationId)
          .maybeSingle(),
      ]);
    if (teamError) throw new Error(teamError.message);
    if (athleteError) throw new Error(athleteError.message);
    if (!team) return fail("That team doesn't belong to your organization.");
    if (!athlete) return fail("That athlete doesn't belong to your organization.");

    const { error } = await supabase
      .from("team_members")
      .insert({ team_id: team.id, athlete_id: athlete.id });
    if (error) {
      if (error.message.includes("team_members_team_id_athlete_id_key")) {
        return fail("That athlete is already on this team's roster.");
      }
      throw new Error(error.message);
    }

    revalidatePath("/admin/teams");
    return ok();
  });
}

export async function removeTeamMember(teamMemberId: string): Promise<ActionResult> {
  return safeAction(async () => {
    const { organizationId } = await requireOrgManager();
    const supabase = await createClient();

    // team_members has no organization column; it's owned through its team.
    const { data: member, error: memberError } = await supabase
      .from("team_members")
      .select("id, team_id")
      .eq("id", teamMemberId)
      .maybeSingle();
    if (memberError) throw new Error(memberError.message);
    if (!member) return fail("That roster entry doesn't exist.");

    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("id")
      .eq("id", member.team_id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (teamError) throw new Error(teamError.message);
    if (!team) return fail("That team doesn't belong to your organization.");

    expectChanged(
      await supabase
        .from("team_members")
        .delete()
        .eq("id", member.id)
        .eq("team_id", team.id)
        .select("id"),
      "remove the team member",
    );
    revalidatePath("/admin/teams");
    return ok();
  });
}
