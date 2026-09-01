"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";

export async function bootstrapOrganization(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Organization name is required.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("bootstrap_organization", { p_name: name });
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
}
