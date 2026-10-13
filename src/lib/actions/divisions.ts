"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { expectChanged, requireEventAccess } from "@/lib/auth/guards";
import { createClient } from "@/lib/db/server";
import { Constants } from "@/lib/db/supabase.types";
import type { EntryFormat } from "@/lib/teams/format";
import { field, parseForm } from "@/lib/validation/form";
import { safeAction } from "./safeAction";

// A division says what competes in it (0036): individuals, or teams of a
// fixed size. A pair is always two; an individual division has no size.

const DivisionForm = z.object({
  name: field.text("Division name", { max: 100 }),
  entry_format: field.optionalOneOf(Constants.public.Enums.competitor_entry_type, "format"),
  team_size: field.optionalNumber("Athletes per team", { min: 2, max: 20 }),
});

const SIZE_REQUIRED = "Athletes per team is required.";
const FORMAT_LOCKED = "This division already has registrations, so its format can't change.";

type Shape = { name: string; entry_format: EntryFormat; team_size: number | null };

/** The stored shape of a posted division, or the field error that stops it. */
function shapeOf(f: z.infer<typeof DivisionForm>): Shape | ActionResult {
  const entry_format = f.entry_format ?? "individual";
  if (entry_format === "individual") return { name: f.name, entry_format, team_size: null };
  if (entry_format === "pair") return { name: f.name, entry_format, team_size: 2 };
  if (f.team_size === null) return fail(SIZE_REQUIRED, { team_size: [SIZE_REQUIRED] });
  if (!Number.isInteger(f.team_size)) {
    const message = "Athletes per team must be a whole number.";
    return fail(message, { team_size: [message] });
  }
  return { name: f.name, entry_format, team_size: f.team_size };
}

const isShape = (s: Shape | ActionResult): s is Shape => "name" in s;

export async function createDivision(eventId: string, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    await requireEventAccess(eventId);
    const shape = shapeOf(parseForm(DivisionForm, formData));
    if (!isShape(shape)) return shape;

    const supabase = await createClient();
    const { error } = await supabase.from("divisions").insert({ event_id: eventId, ...shape });
    if (error) throw new Error(error.message);

    revalidatePath(`/admin/events/${eventId}/divisions`);
    return ok();
  });
}

export async function updateDivision(
  eventId: string,
  divisionId: string,
  formData: FormData,
): Promise<ActionResult> {
  return safeAction(async () => {
    await requireEventAccess(eventId);
    const shape = shapeOf(parseForm(DivisionForm, formData));
    if (!isShape(shape)) return shape;

    const supabase = await createClient();
    const { data: current, error } = await supabase
      .from("divisions")
      .select("entry_format, team_size")
      .eq("id", divisionId)
      .eq("event_id", eventId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!current) return fail("That division isn't part of this event.");

    // Athletes and teams registered under one format can't be reinterpreted
    // as the other; the format is fixed once anyone is in the division.
    if (current.entry_format !== shape.entry_format || current.team_size !== shape.team_size) {
      const registrations = await supabase
        .from("registrations")
        .select("id")
        .eq("division_id", divisionId)
        .limit(1);
      if (registrations.error) throw new Error(registrations.error.message);
      if (registrations.data?.length) return fail(FORMAT_LOCKED);
      const teams = await supabase
        .from("teams")
        .select("id")
        .eq("division_id", divisionId)
        .limit(1);
      if (teams.error) throw new Error(teams.error.message);
      if (teams.data?.length) return fail(FORMAT_LOCKED);
    }

    const saved = await supabase
      .from("divisions")
      .update(shape)
      .eq("id", divisionId)
      .eq("event_id", eventId)
      .select("id");
    // The database refuses too (0036), for a registration that landed between
    // the check above and this update.
    if (saved.error?.message.includes("division_format_locked")) return fail(FORMAT_LOCKED);
    expectChanged(saved, "save the division");
    revalidatePath(`/admin/events/${eventId}/divisions`);
    return ok();
  });
}

export async function deleteDivision(eventId: string, divisionId: string): Promise<ActionResult> {
  return safeAction(async () => {
    await requireEventAccess(eventId);
    const supabase = await createClient();
    expectChanged(
      await supabase
        .from("divisions")
        .delete()
        .eq("id", divisionId)
        .eq("event_id", eventId)
        .select("id"),
      "remove the division",
    );
    revalidatePath(`/admin/events/${eventId}/divisions`);
    return ok();
  });
}
