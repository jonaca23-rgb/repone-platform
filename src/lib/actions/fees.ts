"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { getSessionContext } from "@/lib/auth/session";
import type { CompetitorEntryType } from "@/lib/db/database.types";

function readEntryType(formData: FormData): CompetitorEntryType | null {
  const raw = String(formData.get("entry_type") ?? "");
  return raw === "individual" || raw === "pair" || raw === "team" || raw === "custom" ? raw : null;
}

function readAmountCents(formData: FormData): number {
  const raw = String(formData.get("amount_dollars") ?? "").trim();
  const dollars = Number(raw);
  if (!raw || Number.isNaN(dollars) || dollars < 0) throw new Error("Enter a valid fee amount.");
  return Math.round(dollars * 100);
}

/**
 * Fee schedules are the priceable "menu" a future Stripe checkout would read
 * from. Nothing here calls Stripe — this just lets an organizer define what
 * things cost, scoped by division and/or entry type (individual/pair/team/
 * custom), so payments recorded against a registration can reference one.
 */
export async function createFeeSchedule(eventId: string, formData: FormData) {
  const ctx = await getSessionContext();
  if (!ctx?.organizationId) throw new Error("No organization on this account yet.");

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "") || null;
  const division_id = String(formData.get("division_id") ?? "") || null;
  const entry_type = readEntryType(formData);
  const is_addon = formData.get("is_addon") === "on";
  const amount_cents = readAmountCents(formData);
  if (!name) throw new Error("Fee name is required.");

  const supabase = await createClient();
  const { error } = await supabase.from("fee_schedules").insert({
    organization_id: ctx.organizationId,
    event_id: eventId,
    division_id,
    entry_type,
    name,
    description,
    amount_cents,
    is_addon,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/events/${eventId}/fees`);
}

export async function toggleFeeScheduleActive(
  eventId: string,
  feeScheduleId: string,
  active: boolean,
) {
  const supabase = await createClient();
  const { error } = await supabase.from("fee_schedules").update({ active }).eq("id", feeScheduleId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/events/${eventId}/fees`);
}

export async function deleteFeeSchedule(eventId: string, feeScheduleId: string) {
  const supabase = await createClient();
  await supabase.from("fee_schedules").delete().eq("id", feeScheduleId);
  revalidatePath(`/admin/events/${eventId}/fees`);
}
