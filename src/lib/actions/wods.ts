"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionResult, ok } from "@/lib/action-result";
import { expectChanged, requireEventAccess } from "@/lib/auth/guards";
import { createClient } from "@/lib/db/server";
import { Constants } from "@/lib/db/supabase.types";
import { field, parseForm } from "@/lib/validation/form";
import { safeAction } from "./safeAction";

const WodForm = z.object({
  name: field.text("WOD name", { max: 100 }),
  scoring_type: field.oneOf(Constants.public.Enums.scoring_type, "scoring type"),
  tiebreak_type: field.oneOf(Constants.public.Enums.tiebreak_type, "tie-break"),
  description: field.optionalText({ label: "Description" }),
  rules: field.optionalText({ label: "Rules" }),
  time_cap_minutes: field.optionalNumber("Time cap", { min: 0, max: 600 }),
});

function wodRow(formData: FormData) {
  const f = parseForm(WodForm, formData);
  return {
    name: f.name,
    description: f.description,
    rules: f.rules,
    scoring_type: f.scoring_type,
    tiebreak_type: f.tiebreak_type,
    time_cap_seconds: f.time_cap_minutes === null ? null : Math.round(f.time_cap_minutes * 60),
    lower_is_better: f.scoring_type === "for_time",
  };
}

export async function createWod(eventId: string, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    await requireEventAccess(eventId);
    const row = wodRow(formData);

    const supabase = await createClient();
    const { error } = await supabase.from("wods").insert({ event_id: eventId, ...row });
    if (error) throw new Error(error.message);

    revalidatePath(`/admin/events/${eventId}/wods`);
    return ok();
  });
}

export async function updateWod(
  eventId: string,
  wodId: string,
  formData: FormData,
): Promise<ActionResult> {
  return safeAction(async () => {
    await requireEventAccess(eventId);
    const row = wodRow(formData);

    const supabase = await createClient();
    expectChanged(
      await supabase.from("wods").update(row).eq("id", wodId).eq("event_id", eventId).select("id"),
      "save the WOD",
    );

    revalidatePath(`/admin/events/${eventId}/wods`);
    return ok();
  });
}

export async function deleteWod(eventId: string, wodId: string): Promise<ActionResult> {
  return safeAction(async () => {
    await requireEventAccess(eventId);
    const supabase = await createClient();
    expectChanged(
      await supabase.from("wods").delete().eq("id", wodId).eq("event_id", eventId).select("id"),
      "remove the WOD",
    );
    revalidatePath(`/admin/events/${eventId}/wods`);
    return ok();
  });
}
