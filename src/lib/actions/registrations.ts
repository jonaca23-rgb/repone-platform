"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { expectChanged, NotAuthorizedError, requireEventAccess } from "@/lib/auth/guards";
import { createClient } from "@/lib/db/server";
import { field, parseForm, ValidationError } from "@/lib/validation/form";

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

/** The division must belong to this event; returns an error message or null. */
async function divisionError(supabase: Supabase, eventId: string, divisionId: string) {
  const { data, error } = await supabase
    .from("divisions")
    .select("id")
    .eq("id", divisionId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (error) return error.message;
  return data ? null : "That division isn't part of this event.";
}

/** Guard/validation failures become `{ error }` for useActionState; anything else still throws. */
function expectedError(e: unknown): { error: string } {
  if (e instanceof ValidationError || e instanceof NotAuthorizedError) return { error: e.message };
  throw e;
}

async function rememberDivision(eventId: string, divisionId: string) {
  const cookieStore = await cookies();
  cookieStore.set(lastDivisionCookieName(eventId), divisionId, {
    maxAge: 60 * 60 * 24 * 180,
    sameSite: "lax",
  });
}

/**
 * Returns `{ error }` instead of throwing so it plugs into `useActionState`
 * (see RegisterForms.tsx) — a thrown error here used to surface as Next's
 * full-page/dev error overlay instead of a normal, dismissable alert.
 */
export async function registerAthlete(
  eventId: string,
  _prevState: { error: string },
  formData: FormData,
): Promise<{ error: string }> {
  let organizationId: string;
  let form: z.infer<typeof AthleteRegistrationForm>;
  try {
    ({ organizationId } = await requireEventAccess(eventId));
    form = parseForm(AthleteRegistrationForm, formData);
  } catch (e) {
    return expectedError(e);
  }
  const { division_id, athlete_id, bib_number } = form;

  const supabase = await createClient();

  const divisionProblem = await divisionError(supabase, eventId, division_id);
  if (divisionProblem) return { error: divisionProblem };

  const { data: athlete, error: athleteError } = await supabase
    .from("athletes")
    .select("id")
    .eq("id", athlete_id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (athleteError) return { error: athleteError.message };
  if (!athlete) return { error: "That athlete isn't in this event's organization." };

  // Registering the same athlete into the same division twice used to go
  // through silently — generateHeats() then had two registration rows to
  // place, which could land the same athlete in two lanes of one heat (a
  // duplicate-key crash on Score Keeper, and a real double-booking).
  const { data: existing, error: existingError } = await supabase
    .from("registrations")
    .select("id")
    .eq("event_id", eventId)
    .eq("division_id", division_id)
    .eq("athlete_id", athlete_id)
    .maybeSingle();
  if (existingError) return { error: existingError.message };
  if (existing) return { error: "This athlete is already registered in this division/category." };

  const { error } = await supabase
    .from("registrations")
    .insert({ event_id: eventId, division_id, athlete_id, bib_number });
  if (error) {
    // 23505 = unique_violation — DB-level backstop from
    // 0012_prevent_duplicate_lane_and_registration_assignments.sql.
    if (error.code === "23505")
      return { error: "This athlete is already registered in this division/category." };
    return { error: error.message };
  }

  await rememberDivision(eventId, division_id);
  revalidatePath(`/admin/events/${eventId}/athletes`);
  return { error: "" };
}

export async function registerTeam(
  eventId: string,
  _prevState: { error: string },
  formData: FormData,
): Promise<{ error: string }> {
  let organizationId: string;
  let form: z.infer<typeof TeamRegistrationForm>;
  try {
    ({ organizationId } = await requireEventAccess(eventId));
    form = parseForm(TeamRegistrationForm, formData);
  } catch (e) {
    return expectedError(e);
  }
  const { division_id, team_id, bib_number } = form;

  const supabase = await createClient();

  const divisionProblem = await divisionError(supabase, eventId, division_id);
  if (divisionProblem) return { error: divisionProblem };

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id")
    .eq("id", team_id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (teamError) return { error: teamError.message };
  if (!team) return { error: "That team isn't in this event's organization." };

  const { data: existing, error: existingError } = await supabase
    .from("registrations")
    .select("id")
    .eq("event_id", eventId)
    .eq("division_id", division_id)
    .eq("team_id", team_id)
    .maybeSingle();
  if (existingError) return { error: existingError.message };
  if (existing) return { error: "This team is already registered in this division/category." };

  const { error } = await supabase
    .from("registrations")
    .insert({ event_id: eventId, division_id, team_id, bib_number });
  if (error) {
    if (error.code === "23505")
      return { error: "This team is already registered in this division/category." };
    return { error: error.message };
  }

  await rememberDivision(eventId, division_id);
  revalidatePath(`/admin/events/${eventId}/athletes`);
  return { error: "" };
}

export async function removeRegistration(eventId: string, registrationId: string) {
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
}
