"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionResult, ok } from "@/lib/action-result";
import { expectChanged, requireEventAccess } from "@/lib/auth/guards";
import { createClient } from "@/lib/db/server";
import { field, parseForm } from "@/lib/validation/form";
import { safeAction } from "./safeAction";

const DivisionForm = z.object({ name: field.text("Division name", { max: 100 }) });

export async function createDivision(eventId: string, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    await requireEventAccess(eventId);
    const { name } = parseForm(DivisionForm, formData);

    const supabase = await createClient();
    const { error } = await supabase.from("divisions").insert({ event_id: eventId, name });
    if (error) throw new Error(error.message);

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
