"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { expectChanged, requireOrgManager } from "@/lib/auth/guards";
import { createClient } from "@/lib/db/server";
import { field, parseForm } from "@/lib/validation/form";
import { safeAction } from "./safeAction";

// Packages are what a sponsor can buy for an event (0032). They replace the
// old tier enum and are never deleted, only switched off: sponsorships keep
// pointing at them.

const PackageForm = z.object({
  name: field.text("Package name", { max: 100 }),
  display_enabled: field.checkbox(),
  display_duration_seconds: field.int("Display duration", { min: 3, max: 60 }),
  display_weight: field.int("Display weight", { min: 1, max: 10 }),
  sort_order: field.int("Order", { min: 0, max: 1000 }).default(0),
});

const DUPLICATE = "A package with that name already exists.";
const isDuplicate = (message: string) =>
  message.includes("sponsor_packages_organization_id_name_key");

// Packages are the Packages tab of /admin/sponsors.
const PATH = "/admin/sponsors";

export async function createSponsorPackage(formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { organizationId } = await requireOrgManager();
    const f = parseForm(PackageForm, formData);
    const supabase = await createClient();
    const { error } = await supabase
      .from("sponsor_packages")
      .insert({ organization_id: organizationId, ...f });
    if (error) {
      if (isDuplicate(error.message)) return fail(DUPLICATE, { name: [DUPLICATE] });
      throw new Error(error.message);
    }
    revalidatePath(PATH);
    return ok();
  });
}

export async function updateSponsorPackage(
  packageId: string,
  formData: FormData,
): Promise<ActionResult> {
  return safeAction(async () => {
    const { organizationId } = await requireOrgManager();
    const f = parseForm(PackageForm, formData);
    const supabase = await createClient();
    const res = await supabase
      .from("sponsor_packages")
      .update(f)
      .eq("id", packageId)
      .eq("organization_id", organizationId)
      .select("id");
    if (res.error && isDuplicate(res.error.message)) return fail(DUPLICATE, { name: [DUPLICATE] });
    expectChanged(res, "update the package");
    revalidatePath(PATH);
    return ok();
  });
}

export async function togglePackageActive(
  packageId: string,
  active: boolean,
): Promise<ActionResult> {
  return safeAction(async () => {
    const { organizationId } = await requireOrgManager();
    if (typeof active !== "boolean") return fail("Invalid package status.");
    const supabase = await createClient();
    expectChanged(
      await supabase
        .from("sponsor_packages")
        .update({ active })
        .eq("id", packageId)
        .eq("organization_id", organizationId)
        .select("id"),
      "update the package",
    );
    revalidatePath(PATH);
    return ok();
  });
}
