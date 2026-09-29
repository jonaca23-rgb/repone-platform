"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { getSessionContext } from "@/lib/auth/session";
import type { ExpenseCategory } from "@/lib/db/database.types";

const CATEGORIES: ExpenseCategory[] = [
  "venue",
  "equipment",
  "staff_judges",
  "prizes",
  "marketing",
  "other",
];

function readCategory(formData: FormData): ExpenseCategory {
  const raw = String(formData.get("category") ?? "other");
  return (CATEGORIES as string[]).includes(raw) ? (raw as ExpenseCategory) : "other";
}

function readAmountCents(formData: FormData): number {
  const raw = String(formData.get("amount_dollars") ?? "").trim();
  const dollars = Number(raw);
  if (!raw || Number.isNaN(dollars) || dollars < 0)
    throw new Error("Enter a valid expense amount.");
  return Math.round(dollars * 100);
}

/**
 * A hand-entered spending record for an event — the other half of the
 * Income & Expense Statement, alongside the existing `payments` ledger.
 * Same manual-bookkeeping philosophy as Payments: nothing here talks to a
 * bank feed or accounting software, it's just what the organizer typed in.
 */
export async function createExpense(eventId: string, formData: FormData) {
  const ctx = await getSessionContext();
  if (!ctx?.organizationId) throw new Error("No organization on this account yet.");

  const description = String(formData.get("description") ?? "").trim();
  if (!description) throw new Error("Expense description is required.");
  const category = readCategory(formData);
  const amount_cents = readAmountCents(formData);
  const incurred_on = String(formData.get("incurred_on") ?? "") || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert({
    organization_id: ctx.organizationId,
    event_id: eventId,
    category,
    description,
    amount_cents,
    incurred_on,
    notes,
    recorded_by: ctx.userId,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/events/${eventId}/statement`);
}

export async function deleteExpense(eventId: string, expenseId: string) {
  const supabase = await createClient();
  await supabase.from("expenses").delete().eq("id", expenseId);
  revalidatePath(`/admin/events/${eventId}/statement`);
}
