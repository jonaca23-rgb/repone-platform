"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionFailure, type ActionResult, fail, ok } from "@/lib/action-result";
import { requireEventAccess } from "@/lib/auth/guards";
import { createClient } from "@/lib/db/server";
import type { Insert, PaymentStatus } from "@/lib/db/database.types";
import { Constants } from "@/lib/db/supabase.types";
import { field, parseForm } from "@/lib/validation/form";
import { safeAction } from "./safeAction";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const RegistrationPaymentForm = z.object({
  fee_schedule_id: field.optionalId("Fee"),
  status: field.oneOf(Constants.public.Enums.payment_status, "payment status"),
  payment_method: field.oneOf(Constants.public.Enums.payment_method_type, "payment method"),
  notes: field.optionalText({ max: 1000, label: "Notes" }),
  // Blank means "use the fee's amount" (or keep the current one).
  amount_dollars: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.coerce
      .number({ error: "Enter a valid amount." })
      .min(0, "Enter a valid amount.")
      .max(1_000_000, "Amount is too large.")
      .optional(),
  ),
});

const StatusArg = field.oneOf(Constants.public.Enums.payment_status, "payment status");

/** `payments` has no event_id: the registration it hangs off must be in this event. */
async function registrationFailure(
  supabase: Supabase,
  eventId: string,
  registrationId: string,
): Promise<ActionFailure | null> {
  const { data, error } = await supabase
    .from("registrations")
    .select("id")
    .eq("id", registrationId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? null : fail("That registration isn't part of this event.");
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
): Promise<ActionResult> {
  return safeAction(async () => {
    const { ctx } = await requireEventAccess(eventId);
    const f = parseForm(RegistrationPaymentForm, formData);
    const supabase = await createClient();
    const notHere = await registrationFailure(supabase, eventId, registrationId);
    if (notHere) return notHere;

    let amount_cents: number | undefined;
    if (f.fee_schedule_id) {
      const { data: fee, error } = await supabase
        .from("fee_schedules")
        .select("amount_cents")
        .eq("id", f.fee_schedule_id)
        .eq("event_id", eventId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!fee) {
        return fail("That fee isn't part of this event.", {
          fee_schedule_id: ["Choose one of this event's fees."],
        });
      }
      amount_cents = fee.amount_cents;
    }
    if (f.amount_dollars !== undefined) amount_cents = Math.round(f.amount_dollars * 100);

    const payload: Insert<"payments"> = {
      registration_id: registrationId,
      fee_schedule_id: f.fee_schedule_id,
      status: f.status,
      payment_method: f.payment_method,
      notes: f.notes,
      recorded_by: ctx.userId,
    };
    if (amount_cents !== undefined) payload.amount_cents = amount_cents;

    const { error } = await supabase
      .from("payments")
      .upsert(payload, { onConflict: "registration_id" });
    if (error) throw new Error(error.message);

    revalidatePath(`/admin/events/${eventId}/payments`);
    return ok();
  });
}

/** Shared by the Payments page and Check-In; callers must have run the event guard. */
async function setPaymentStatus(
  userId: string,
  eventId: string,
  registrationId: string,
  rawStatus: PaymentStatus,
): Promise<ActionFailure | null> {
  const parsed = StatusArg.safeParse(rawStatus);
  if (!parsed.success) return fail("Choose a valid payment status.");
  const status = parsed.data;

  const supabase = await createClient();
  const notHere = await registrationFailure(supabase, eventId, registrationId);
  if (notHere) return notHere;

  const payload: Insert<"payments"> = {
    registration_id: registrationId,
    status,
    recorded_by: userId,
  };
  // Only nudge payment_method when it's still meaningless ("unpaid"→marking
  // paid defaults to cash); never overwrite a method someone already chose.
  if (status === "paid") {
    const { data: existing, error } = await supabase
      .from("payments")
      .select("payment_method")
      .eq("registration_id", registrationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!existing || existing.payment_method === "unpaid") payload.payment_method = "cash";
  }
  if (status === "unpaid") payload.payment_method = "unpaid";

  const { error } = await supabase
    .from("payments")
    .upsert(payload, { onConflict: "registration_id" });
  if (error) throw new Error(error.message);
  return null;
}

/** Quick one-click status toggle (mirrors the Sponsors "Active" pill pattern). */
export async function markPaymentStatus(
  eventId: string,
  registrationId: string,
  status: PaymentStatus,
): Promise<ActionResult> {
  return safeAction(async () => {
    const { ctx } = await requireEventAccess(eventId);
    const failed = await setPaymentStatus(ctx.userId, eventId, registrationId, status);
    if (failed) return failed;
    revalidatePath(`/admin/events/${eventId}/payments`);
    return ok();
  });
}

/**
 * Same quick toggle as markPaymentStatus, called from the athlete Check-In
 * screen instead of the event Payments page — the only difference is which
 * route gets revalidated afterward, since that screen lives at a URL keyed
 * by athlete rather than by event. Check-In lives under /admin (admins and
 * event directors only), so this stays managers-only too.
 */
export async function markPaymentStatusForCheckin(
  athleteId: string,
  eventId: string,
  registrationId: string,
  status: PaymentStatus,
): Promise<ActionResult> {
  return safeAction(async () => {
    const { ctx } = await requireEventAccess(eventId);
    const athlete = field.id("Athlete").safeParse(athleteId);
    if (!athlete.success) return fail("Athlete is missing or invalid.");
    const failed = await setPaymentStatus(ctx.userId, eventId, registrationId, status);
    if (failed) return failed;
    revalidatePath(`/admin/events/${eventId}/payments`);
    revalidatePath(`/admin/checkin/${athlete.data}`);
    return ok();
  });
}
