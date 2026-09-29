"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { getSessionContext } from "@/lib/auth/session";
import type { SponsorTier } from "@/lib/db/database.types";

export async function createSponsor(formData: FormData) {
  const ctx = await getSessionContext();
  if (!ctx?.organizationId) throw new Error("No organization on this account yet.");

  const business_name = String(formData.get("business_name") ?? "").trim();
  const tier = String(formData.get("tier") ?? "logo_sponsor") as SponsorTier;
  const category = String(formData.get("category") ?? "") || null;
  const category_exclusive = formData.get("category_exclusive") === "on";
  const website = String(formData.get("website") ?? "") || null;
  const event_id = String(formData.get("event_id") ?? "") || null;
  if (!business_name) throw new Error("Business name is required.");

  const supabase = await createClient();
  const { error } = await supabase.from("sponsors").insert({
    organization_id: ctx.organizationId,
    business_name,
    tier,
    category,
    category_exclusive,
    website,
    event_id,
  });
  if (error) {
    if (error.message.includes("sponsors_category_exclusive_uidx")) {
      throw new Error(
        `Another active sponsor already holds exclusive category "${category}" for this event.`,
      );
    }
    throw new Error(error.message);
  }

  revalidatePath("/admin/sponsors");
}

export async function toggleSponsorActive(sponsorId: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("sponsors").update({ active }).eq("id", sponsorId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/sponsors");
}
