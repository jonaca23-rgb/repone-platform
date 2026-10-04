"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { type ActionFailure, type ActionResult, fail, ok } from "@/lib/action-result";
import { expectChanged, requireEventAccess } from "@/lib/auth/guards";
import { createClient } from "@/lib/db/server";
import { field, parseForm } from "@/lib/validation/form";
import { safeAction } from "./safeAction";

// Registering a whole category (e.g. 15 athletes into "Rx Male") one at a
// time means re-picking the same division every single submit. Remembering
// the last division used — per event, in a cookie rather than a DB column,
// since this is a pure per-browser convenience with no need to sync across
// staff/devices — lets the Athletes & Registrations page default the
// division select to it, so the operator only has to change it when they
// actually move on to a new category.
function lastDivisionCookieName(eventId: string) {
  return `repone_last_division_${eventId}`;
}

const AthleteRegistrationForm = z.object({
  division_id: field.id("Division"),
  athlete_id: field.id("Athlete"),
  bib_number: field.optionalText({ max: 20, label: "Bib number" }),
});

const TeamRegistrationForm = z.object({
  division_id: field.id("Division"),
  team_id: field.id("Team"),
  bib_number: field.optionalText({ max: 20, label: "Bib number" }),
});

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** The division must belong to this event; returns the failure, or null. */
async function divisionFailure(
  supabase: Supabase,
  eventId: string,
  divisionId: string,
): Promise<ActionFailure | null> {
  const { data, error } = await supabase
    .from("divisions")
    .select("id")
    .eq("id", divisionId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (error) return fail(error.message);
  return data
    ? null
    : fail("That division isn't part of this event.", {
        division_id: ["Choose one of this event's divisions."],
      });
}

async function rememberDivision(eventId: string, divisionId: string) {
  const cookieStore = await cookies();
  cookieStore.set(lastDivisionCookieName(eventId), divisionId, {
    maxAge: 60 * 60 * 24 * 180,
    sameSite: "lax",
  });
}

export async function registerAthlete(eventId: string, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { organizationId } = await requireEventAccess(eventId);
    const { division_id, athlete_id, bib_number } = parseForm(AthleteRegistrationForm, formData);
    const supabase = await createClient();

    const divisionProblem = await divisionFailure(supabase, eventId, division_id);
    if (divisionProblem) return divisionProblem;

    const { data: athlete, error: athleteError } = await supabase
      .from("athletes")
      .select("id")
      .eq("id", athlete_id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (athleteError) return fail(athleteError.message);
    if (!athlete) return fail("That athlete isn't in this event's organization.");

    const { data: existing, error: existingError } = await supabase
      .from("registrations")
      .select("id")
      .eq("event_id", eventId)
      .eq("division_id", division_id)
      .eq("athlete_id", athlete_id)
      .maybeSingle();
    if (existingError) return fail(existingError.message);
    if (existing) return fail("This athlete is already registered in this division/category.");

    const { error } = await supabase
      .from("registrations")
      .insert({ event_id: eventId, division_id, athlete_id, bib_number });
    if (error) {
      if (error.code === "23505")
        return fail("This athlete is already registered in this division/category.");
      return fail(error.message);
    }

    await rememberDivision(eventId, division_id);
    revalidatePath(`/admin/events/${eventId}/athletes`);
    return ok();
  });
}

export async function registerTeam(eventId: string, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { organizationId } = await requireEventAccess(eventId);
    const { division_id, team_id, bib_number } = parseForm(TeamRegistrationForm, formData);
    const supabase = await createClient();

    const divisionProblem = await divisionFailure(supabase, eventId, division_id);
    if (divisionProblem) return divisionProblem;

    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("id")
      .eq("id", team_id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (teamError) return fail(teamError.message);
    if (!team) return fail("That team isn't in this event's organization.");

    const { data: existing, error: existingError } = await supabase
      .from("registrations")
      .select("id")
      .eq("event_id", eventId)
      .eq("division_id", division_id)
      .eq("team_id", team_id)
      .maybeSingle();
    if (existingError) return fail(existingError.message);
    if (existing) return fail("This team is already registered in this division/category.");

    const { error } = await supabase
      .from("registrations")
      .insert({ event_id: eventId, division_id, team_id, bib_number });
    if (error) {
      if (error.code === "23505")
        return fail("This team is already registered in this division/category.");
      return fail(error.message);
    }

    await rememberDivision(eventId, division_id);
    revalidatePath(`/admin/events/${eventId}/athletes`);
    return ok();
  });
}

export async function removeRegistration(
  eventId: string,
  registrationId: string,
): Promise<ActionResult> {
  return safeAction(async () => {
    await requireEventAccess(eventId);
    const supabase = await createClient();
    expectChanged(
      await supabase
        .from("registrations")
        .delete()
        .eq("id", registrationId)
        .eq("event_id", eventId)
        .select("id"),
      "remove the registration",
    );
    revalidatePath(`/admin/events/${eventId}/athletes`);
    return ok();
  });
}
