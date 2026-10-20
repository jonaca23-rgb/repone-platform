"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { expectChanged, requireEventAccess } from "@/lib/auth/guards";
import { createClient } from "@/lib/db/server";
import { Constants } from "@/lib/db/supabase.types";
import { field, parseForm } from "@/lib/validation/form";
import { safeAction } from "./safeAction";

const FeeScheduleForm = z.object({
  name: field.text("Fee name", { max: 100 }),
  description: field.optionalText({ max: 500, label: "Description" }),
  division_id: field.optionalId("Division"),
  // Blank means "any entry type".
  entry_type: field.optionalOneOf(Constants.public.Enums.competitor_entry_type, "entry type"),
  is_addon: field.checkbox(),
  amount_dollars: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.coerce
      .number({ error: "Enter a valid fee amount." })
      .min(0, "Enter a valid fee amount.")
      .max(1_000_000, "Fee amount is too large."),
  ),
});

/**
 * Fee schedules are the priceable "menu" a future Stripe checkout would read
 * from. Nothing here calls Stripe — this just lets an organizer define what
 * things cost, scoped by division and/or entry type (individual/pair/team/
 * custom), so payments recorded against a registration can reference one.
 */
export async function createFeeSchedule(
  eventId: string,
  formData: FormData,
): Promise<ActionResult> {
  return safeAction(async () => {
    const { organizationId } = await requireEventAccess(eventId);
    const f = parseForm(FeeScheduleForm, formData);

    const supabase = await createClient();

    if (f.division_id) {
      const { data: division, error } = await supabase
        .from("divisions")
        .select("id")
        .eq("id", f.division_id)
        .eq("event_id", eventId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!division) {
        return fail("That division isn't part of this event.", {
          division_id: ["Choose one of this event's divisions."],
        });
      }
    }

    const { error } = await supabase.from("fee_schedules").insert({
      organization_id: organizationId,
      event_id: eventId,
      division_id: f.division_id,
      entry_type: f.entry_type,
      name: f.name,
      description: f.description,
      amount_cents: Math.round(f.amount_dollars * 100),
      is_addon: f.is_addon,
    });
    if (error) throw new Error(error.message);

    revalidatePath(`/admin/events/${eventId}/fees`);
    return ok();
  });
}

export async function toggleFeeScheduleActive(
  eventId: string,
  feeScheduleId: string,
  active: boolean,
): Promise<ActionResult> {
  return safeAction(async () => {
    await requireEventAccess(eventId);
    const supabase = await createClient();
    expectChanged(
      await supabase
        .from("fee_schedules")
        .update({ active: z.boolean().parse(active) })
        .eq("id", feeScheduleId)
        .eq("event_id", eventId)
        .select("id"),
      "update the fee",
    );
    revalidatePath(`/admin/events/${eventId}/fees`);
    return ok();
  });
}

export async function deleteFeeSchedule(
  eventId: string,
  feeScheduleId: string,
): Promise<ActionResult> {
  return safeAction(async () => {
    await requireEventAccess(eventId);
    const supabase = await createClient();
    expectChanged(
      await supabase
        .from("fee_schedules")
        .delete()
        .eq("id", feeScheduleId)
        .eq("event_id", eventId)
        .select("id"),
      "remove the fee",
    );
    revalidatePath(`/admin/events/${eventId}/fees`);
    return ok();
  });
}
