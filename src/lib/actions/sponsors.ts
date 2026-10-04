"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { expectChanged, requireOrgManager } from "@/lib/auth/guards";
import { createClient } from "@/lib/db/server";
import { Constants } from "@/lib/db/supabase.types";
import { field, parseForm } from "@/lib/validation/form";
import { safeAction } from "./safeAction";

const SponsorForm = z.object({
  business_name: field.text("Business name", { max: 200 }),
  tier: field.oneOf(Constants.public.Enums.sponsor_tier, "sponsor tier").default("logo_sponsor"),
  category: field.optionalText({ max: 100, label: "Category" }),
  category_exclusive: field.checkbox(),
  website: field.optionalText({ max: 500, label: "Website" }),
  event_id: field.optionalId("Event"),
});

export async function createSponsor(formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { organizationId } = await requireOrgManager();
    const f = parseForm(SponsorForm, formData);

    const supabase = await createClient();

    if (f.event_id) {
      const { data: event, error: eventError } = await supabase
        .from("events")
        .select("id")
        .eq("id", f.event_id)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (eventError) throw new Error(eventError.message);
      if (!event) {
        return fail("That event doesn't belong to your organization.", {
          event_id: ["Choose one of your events."],
        });
      }
    }

    const { error } = await supabase.from("sponsors").insert({
      organization_id: organizationId,
      business_name: f.business_name,
      tier: f.tier,
      category: f.category,
      category_exclusive: f.category_exclusive,
      website: f.website,
      event_id: f.event_id,
    });
    if (error) {
      if (error.message.includes("sponsors_category_exclusive_uidx")) {
        return fail(
          `Another active sponsor already holds exclusive category "${f.category}" for this event.`,
        );
      }
      throw new Error(error.message);
    }

    revalidatePath("/admin/sponsors");
    return ok();
  });
}

export async function toggleSponsorActive(
  sponsorId: string,
  active: boolean,
): Promise<ActionResult> {
  return safeAction(async () => {
    const { organizationId } = await requireOrgManager();
    if (typeof active !== "boolean") return fail("Invalid sponsor status.");

    const supabase = await createClient();
    const res = await supabase
      .from("sponsors")
      .update({ active })
      .eq("id", sponsorId)
      .eq("organization_id", organizationId)
      .select("id");
    if (res.error?.message.includes("sponsors_category_exclusive_uidx")) {
      return fail("Another active sponsor already holds this sponsor's exclusive category.");
    }
    expectChanged(res, "update the sponsor");
    revalidatePath("/admin/sponsors");
    return ok();
  });
}
