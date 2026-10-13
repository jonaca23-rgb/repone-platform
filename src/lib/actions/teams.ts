"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { expectChanged, requireEventAccess } from "@/lib/auth/guards";
import { createClient } from "@/lib/db/server";
import { field, parseForm } from "@/lib/validation/form";
import { safeAction } from "./safeAction";

// A team belongs to one event and one of its team divisions (0036). The
// event's organizers create it, which also registers it (one registration,
// one fee), and manage its roster. The database enforces the rules: one team
// per athlete per event, the division's team size, the same organization.
// Its tagged refusals are turned into messages here.

const TeamForm = z.object({
  name: field.text("Team name", { max: 200 }),
  division_id: field.id("Division"),
  affiliate: field.optionalText({ max: 200, label: "Affiliate" }),
});
const TeamEditForm = TeamForm.omit({ division_id: true });
const TeamMemberForm = z.object({
  athlete_id: z.guid({ error: "Choose an athlete to add." }),
});

const INDIVIDUAL_DIVISION = "That division is for individuals. Choose a team division.";
const NAME_TAKEN = "A team with that name already exists in this event.";
const OTHER_TEAM = "That athlete is already on another team in this event.";
const OTHER_ORG = "That athlete isn't part of this organization.";
const HAS_RESULTS = "This team has results and can't be deleted. Remove its results first.";
const NOT_A_MEMBER = "Only a member of the team can be its captain.";
const NOT_THIS_EVENT = "That team isn't part of this event.";

/** A database refusal about the team itself, as a message under the right field. */
function teamRefusal(message: string): ActionResult | null {
  if (message.includes("team_division_individual") || message.includes("registration_kind")) {
    return fail(INDIVIDUAL_DIVISION, { division_id: [INDIVIDUAL_DIVISION] });
  }
  if (message.includes("team_division_event") || message.includes("registration_team_mismatch")) {
    const text = "That division isn't part of this event.";
    return fail(text, { division_id: [text] });
  }
  if (message.includes("teams_event_name_key")) return fail(NAME_TAKEN, { name: [NAME_TAKEN] });
  if (message.includes("team_captain_not_member")) return fail(NOT_A_MEMBER);
  return null;
}

function memberRefusal(message: string, teamSize: number | null): ActionResult | null {
  if (
    message.includes("team_member_other_team") ||
    message.includes("team_members_event_athlete_key")
  ) {
    return fail(OTHER_TEAM);
  }
  if (message.includes("team_full")) {
    return fail(
      teamSize
        ? `This team is full: its division takes ${teamSize} per team.`
        : "This team is full.",
    );
  }
  if (message.includes("team_member_org")) return fail(OTHER_ORG);
  if (message.includes("team_members_team_id_athlete_id_key")) {
    return fail("That athlete is already on this team.");
  }
  return null;
}

function revalidate(eventId: string, registrations = false) {
  revalidatePath(`/admin/events/${eventId}/teams`);
  if (registrations) {
    revalidatePath(`/admin/events/${eventId}/athletes`);
    revalidatePath(`/admin/events/${eventId}/payments`);
  }
}

export async function createTeam(eventId: string, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    await requireEventAccess(eventId);
    const f = parseForm(TeamForm, formData);
    const supabase = await createClient();

    // The database registers the team in the same statement (teams_register,
    // 0036), so it never exists without the registration its fee hangs from.
    const { error } = await supabase.from("teams").insert({
      event_id: eventId,
      division_id: f.division_id,
      name: f.name,
      affiliate: f.affiliate,
    });
    if (error) {
      const refusal = teamRefusal(error.message);
      if (refusal) return refusal;
      throw new Error(error.message);
    }

    revalidate(eventId, true);
    return ok();
  });
}

export async function updateTeam(
  eventId: string,
  teamId: string,
  formData: FormData,
): Promise<ActionResult> {
  return safeAction(async () => {
    await requireEventAccess(eventId);
    const f = parseForm(TeamEditForm, formData);
    const supabase = await createClient();
    const res = await supabase
      .from("teams")
      .update({ name: f.name, affiliate: f.affiliate })
      .eq("id", teamId)
      .eq("event_id", eventId)
      .select("id");
    if (res.error) {
      const refusal = teamRefusal(res.error.message);
      if (refusal) return refusal;
    }
    expectChanged(res, "save the team");
    revalidate(eventId, true);
    return ok();
  });
}

export async function deleteTeam(eventId: string, teamId: string): Promise<ActionResult> {
  return safeAction(async () => {
    await requireEventAccess(eventId);
    const supabase = await createClient();

    // Deleting a team cascades to its results; scored teams are kept.
    const results = await supabase.from("results").select("id").eq("team_id", teamId).limit(1);
    if (results.error) throw new Error(results.error.message);
    if (results.data?.length) return fail(HAS_RESULTS);

    expectChanged(
      await supabase.from("teams").delete().eq("id", teamId).eq("event_id", eventId).select("id"),
      "delete the team",
    );
    revalidate(eventId, true);
    return ok();
  });
}

export async function addTeamMember(
  eventId: string,
  teamId: string,
  formData: FormData,
): Promise<ActionResult> {
  return safeAction(async () => {
    await requireEventAccess(eventId);
    const { athlete_id } = parseForm(TeamMemberForm, formData);
    const supabase = await createClient();

    const { data, error: teamError } = await supabase
      .from("teams")
      .select("id, divisions(team_size)")
      .eq("id", teamId)
      .eq("event_id", eventId)
      .maybeSingle();
    if (teamError) throw new Error(teamError.message);
    const team = data as unknown as {
      id: string;
      divisions: { team_size: number | null } | null;
    } | null;
    if (!team) return fail(NOT_THIS_EVENT);

    const { error } = await supabase
      .from("team_members")
      .insert({ team_id: team.id, athlete_id, event_id: eventId });
    if (error) {
      const refusal = memberRefusal(error.message, team.divisions?.team_size ?? null);
      if (refusal) return refusal;
      throw new Error(error.message);
    }

    revalidate(eventId);
    return ok();
  });
}

export async function removeTeamMember(
  eventId: string,
  teamId: string,
  teamMemberId: string,
): Promise<ActionResult> {
  return safeAction(async () => {
    await requireEventAccess(eventId);
    const supabase = await createClient();
    expectChanged(
      await supabase
        .from("team_members")
        .delete()
        .eq("id", teamMemberId)
        .eq("team_id", teamId)
        .eq("event_id", eventId)
        .select("id"),
      "remove the athlete from the team",
    );
    revalidate(eventId);
    return ok();
  });
}

/** Names the team's captain, or clears it with `null`. The captain must be on the roster. */
export async function setTeamCaptain(
  eventId: string,
  teamId: string,
  athleteId: string | null,
): Promise<ActionResult> {
  return safeAction(async () => {
    await requireEventAccess(eventId);
    if (athleteId !== null && !z.guid().safeParse(athleteId).success) {
      return fail("Choose a member of the team.");
    }
    const supabase = await createClient();
    const res = await supabase
      .from("teams")
      .update({ captain_athlete_id: athleteId })
      .eq("id", teamId)
      .eq("event_id", eventId)
      .select("id");
    if (res.error) {
      const refusal = teamRefusal(res.error.message);
      if (refusal) return refusal;
    }
    expectChanged(res, "set the captain");
    revalidate(eventId);
    return ok();
  });
}
