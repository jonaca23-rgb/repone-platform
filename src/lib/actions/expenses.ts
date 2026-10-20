"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionResult, ok } from "@/lib/action-result";
import { expectChanged, requireEventAccess } from "@/lib/auth/guards";
import { createClient } from "@/lib/db/server";
import { Constants } from "@/lib/db/supabase.types";
import { field, parseForm } from "@/lib/validation/form";
import { safeAction } from "./safeAction";

const ExpenseForm = z.object({
  category: field.oneOf(Constants.public.Enums.expense_category, "expense category"),
  description: field.text("Expense description", { max: 200 }),
  amount_dollars: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.coerce
      .number({ error: "Enter a valid expense amount." })
      .min(0, "Enter a valid expense amount.")
      .max(1_000_000, "Expense amount is too large."),
  ),
  incurred_on: field.optionalDate("Date incurred"),
  notes: field.optionalText({ max: 1000, label: "Notes" }),
});

/**
 * A hand-entered spending record for an event — the other half of the
 * Income & Expense Statement, alongside the existing `payments` ledger.
 * Same manual-bookkeeping philosophy as Payments: nothing here talks to a
 * bank feed or accounting software, it's just what the organizer typed in.
 */
export async function createExpense(eventId: string, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { ctx, organizationId } = await requireEventAccess(eventId);
    const f = parseForm(ExpenseForm, formData);

    const supabase = await createClient();
    const { error } = await supabase.from("expenses").insert({
      organization_id: organizationId,
      event_id: eventId,
      category: f.category,
      description: f.description,
      amount_cents: Math.round(f.amount_dollars * 100),
      incurred_on: f.incurred_on,
      notes: f.notes,
      recorded_by: ctx.userId,
    });
    if (error) throw new Error(error.message);

    revalidatePath(`/admin/events/${eventId}/statement`);
    return ok();
  });
}

export async function deleteExpense(eventId: string, expenseId: string): Promise<ActionResult> {
  return safeAction(async () => {
    await requireEventAccess(eventId);
    const supabase = await createClient();
    expectChanged(
      await supabase
        .from("expenses")
        .delete()
        .eq("id", expenseId)
        .eq("event_id", eventId)
        .select("id"),
      "remove the expense",
    );
    revalidatePath(`/admin/events/${eventId}/statement`);
    return ok();
  });
}
