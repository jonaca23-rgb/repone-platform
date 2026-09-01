"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { getSessionContext } from "@/lib/auth/session";

export async function createAthlete(formData: FormData) {
  const ctx = await getSessionContext();
  if (!ctx?.organizationId) throw new Error("No organization on this account yet.");

  const first_name = String(formData.get("first_name") ?? "").trim();
  const last_name = String(formData.get("last_name") ?? "").trim();
  const affiliate = String(formData.get("affiliate") ?? "") || null;
  if (!first_name || !last_name) throw new Error("First and last name are required.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("athletes")
    .insert({ organization_id: ctx.organizationId, first_name, last_name, affiliate });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/athletes");
}

export async function deleteAthlete(athleteId: string) {
  const supabase = await createClient();
  await supabase.from("athletes").delete().eq("id", athleteId);
  revalidatePath("/admin/athletes");
}
