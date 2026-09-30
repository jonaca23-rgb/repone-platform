"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { getSessionContext } from "@/lib/auth/session";
import type { Insert, PaymentMethodType, PaymentStatus } from "@/lib/db/database.types";

function readStatus(formData: FormData): PaymentStatus {
  const raw = String(formData.get("status") ?? "unpaid");
  return raw === "paid" || raw === "waived" || raw === "refunded" ? raw : "unpaid";
}

function readMethod(formData: FormData): PaymentMethodType {
  const raw = String(formData.get("payment_method") ?? "unpaid");
  return raw === "cash" || raw === "manual_other" || raw === "stripe" ? raw : "unpaid";
}

/**
 * One combined edit per registration: assign a fee schedule (which fills in
 * the amount unless overridden), set status/method, and leave a note. This
 * is a manual ledger update — it never calls Stripe or any payment
 * processor. `payments.registration_id` is unique, so this is always an
 * upsert of exactly one row per competitor entry (individual or team).
 */
export async function updateRegistrationPayment(
  eventId: string,
  registrationId: string,
  formData: FormData,
) {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const fee_schedule_id = String(formData.get("fee_schedule_id") ?? "") || null;
  const status = readStatus(formData);
  const payment_method = readMethod(formData);
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const amountRaw = String(formData.get("amount_dollars") ?? "").trim();

  let amount_cents: number | undefined;
  if (amountRaw) {
    const dollars = Number(amountRaw);
    if (Number.isNaN(dollars) || dollars < 0) throw new Error("Enter a valid amount.");
    amount_cents = Math.round(dollars * 100);
  } else if (fee_schedule_id) {
    const { data: fee } = await supabase
      .from("fee_schedules")
      .select("amount_cents")
      .eq("id", fee_schedule_id)
      .maybeSingle();
    if (fee) amount_cents = fee.amount_cents;
  }

  const payload: Insert<"payments"> = {
    registration_id: registrationId,
    fee_schedule_id,
    status,
    payment_method,
    notes,
    recorded_by: ctx?.userId ?? null,
  };
  if (amount_cents !== undefined) payload.amount_cents = amount_cents;

  const { error } = await supabase
    .from("payments")
    .upsert(payload, { onConflict: "registration_id" });
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/events/${eventId}/payments`);
}

/** Quick one-click status toggle (mirrors the Sponsors "Active" pill pattern). */
export async function markPaymentStatus(
  eventId: string,
  registrationId: string,
  status: PaymentStatus,
) {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const payload: Insert<"payments"> = {
    registration_id: registrationId,
    status,
    recorded_by: ctx?.userId ?? null,
  };
  // Only nudge payment_method when it's still meaningless ("unpaid"→marking
  // paid defaults to cash); never overwrite a method someone already chose.
  if (status === "paid") {
    const { data: existing } = await supabase
      .from("payments")
      .select("payment_method")
      .eq("registration_id", registrationId)
      .maybeSingle();
    if (!existing || existing.payment_method === "unpaid") payload.payment_method = "cash";
  }
  if (status === "unpaid") payload.payment_method = "unpaid";

  const { error } = await supabase
    .from("payments")
    .upsert(payload, { onConflict: "registration_id" });
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/events/${eventId}/payments`);
}

/**
 * Same quick toggle as markPaymentStatus, called from the athlete Check-In
 * screen instead of the event Payments page — the only difference is which
 * route gets revalidated afterward, since that screen lives at a URL keyed
 * by athlete rather than by event.
 */
export async function markPaymentStatusForCheckin(
  athleteId: string,
  eventId: string,
  registrationId: string,
  status: PaymentStatus,
) {
  await markPaymentStatus(eventId, registrationId, status);
  revalidatePath(`/admin/checkin/${athleteId}`);
}
