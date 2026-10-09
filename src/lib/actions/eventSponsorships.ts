"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { expectChanged, requireOrgManager } from "@/lib/auth/guards";
import { createClient } from "@/lib/db/server";
import { field, parseForm } from "@/lib/validation/form";
import { safeAction } from "./safeAction";

// What a sponsor bought for one event: a package, whether it holds its
// category exclusively, and optional overrides of the package's display
// duration and weight (blank = the package default).

const AddForm = z.object({
  sponsor_id: field.id("Sponsor"),
  package_id: field.id("Package"),
  category_exclusive: field.checkbox(),
});

const optionalWhole = (label: string, min: number, max: number) =>
  field
    .optionalNumber(label, { min, max })
    .refine((v) => v === null || Number.isInteger(v), `${label} must be a whole number.`);

const UpdateForm = z.object({
  package_id: field.id("Package"),
  category_exclusive: field.checkbox(),
  display_duration_override: optionalWhole("Display duration", 3, 60),
  display_weight_override: optionalWhole("Display weight", 1, 10),
});

const EXCLUSIVE = "Another active sponsor holds this category exclusively at this event.";
const ALREADY = "That sponsor is already part of this event.";

/** The database's refusals a manager can act on; anything else is unexpected. */
function refusal(message: string): ActionResult | null {
  if (message.includes("sponsor_category_exclusive")) return fail(EXCLUSIVE);
  if (message.includes("event_sponsorships_event_id_sponsor_id_key")) {
    return fail(ALREADY, { sponsor_id: [ALREADY] });
  }
  return null;
}

/** The manager's client when the event is theirs, else null. */
async function ownedEvent(eventId: string) {
  const { organizationId } = await requireOrgManager();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("id")
    .eq("id", eventId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? supabase : null;
}

const NOT_OURS = "That event doesn't belong to your organization.";

function revalidate(eventId: string) {
  revalidatePath(`/admin/events/${eventId}/sponsors`);
  revalidatePath(`/producer/events/${eventId}/sponsors`);
  revalidatePath(`/producer/events/${eventId}/production`);
}

export async function addEventSponsorship(
  eventId: string,
  formData: FormData,
): Promise<ActionResult> {
  return safeAction(async () => {
    const supabase = await ownedEvent(eventId);
    if (!supabase) return fail(NOT_OURS);
    const f = parseForm(AddForm, formData);
    const { error } = await supabase.from("event_sponsorships").insert({ event_id: eventId, ...f });
    if (error) {
      const r = refusal(error.message);
      if (r) return r;
      throw new Error(error.message);
    }
    revalidate(eventId);
    return ok();
  });
}

export async function updateEventSponsorship(
  eventId: string,
  sponsorshipId: string,
  formData: FormData,
): Promise<ActionResult> {
  return safeAction(async () => {
    const supabase = await ownedEvent(eventId);
    if (!supabase) return fail(NOT_OURS);
    const f = parseForm(UpdateForm, formData);
    const res = await supabase
      .from("event_sponsorships")
      .update({
        package_id: f.package_id,
        category_exclusive: f.category_exclusive,
        display_duration_override: f.display_duration_override,
        display_weight_override: f.display_weight_override,
      })
      .eq("id", sponsorshipId)
      .eq("event_id", eventId)
      .select("id");
    if (res.error) {
      const r = refusal(res.error.message);
      if (r) return r;
    }
    expectChanged(res, "update the sponsorship");
    revalidate(eventId);
    return ok();
  });
}

export async function toggleEventSponsorshipActive(
  eventId: string,
  sponsorshipId: string,
  active: boolean,
): Promise<ActionResult> {
  return safeAction(async () => {
    const supabase = await ownedEvent(eventId);
    if (!supabase) return fail(NOT_OURS);
    if (typeof active !== "boolean") return fail("Invalid sponsorship status.");
    const res = await supabase
      .from("event_sponsorships")
      .update({ active })
      .eq("id", sponsorshipId)
      .eq("event_id", eventId)
      .select("id");
    if (res.error) {
      const r = refusal(res.error.message);
      if (r) return r;
    }
    expectChanged(res, "update the sponsorship");
    revalidate(eventId);
    return ok();
  });
}
