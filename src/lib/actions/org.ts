"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionResult, ok } from "@/lib/action-result";
import { requireSignedIn } from "@/lib/auth/guards";
import { createClient } from "@/lib/db/server";
import { field, parseForm } from "@/lib/validation/form";
import { safeAction } from "./safeAction";

const OrganizationForm = z.object({ name: field.text("Organization name", { max: 200 }) });

// Any signed-in user may call this; the bootstrap_organization database
// function itself refuses once an organization already exists.
export async function bootstrapOrganization(formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    await requireSignedIn();
    const { name } = parseForm(OrganizationForm, formData);

    const supabase = await createClient();
    const { error } = await supabase.rpc("bootstrap_organization", { p_name: name });
    if (error) throw new Error(error.message);

    revalidatePath("/admin");
    return ok();
  });
}
