"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { expectChanged, requireOrgManager } from "@/lib/auth/guards";
import { createClient } from "@/lib/db/server";
import { field, imageUpload, parseForm, ValidationError } from "@/lib/validation/form";
import { safeAction } from "./safeAction";

// A sponsor is one org-level record. What it bought for an event (package,
// exclusivity, display overrides) lives in ./eventSponsorships.

const SponsorForm = z.object({
  business_name: field.text("Business name", { max: 200 }),
  category: field.optionalText({ max: 100, label: "Category" }),
  website: field.optionalText({ max: 500, label: "Website" }),
  notes: field.optionalText({ max: 2000, label: "Notes" }),
});

const BUCKET = "sponsor-creatives";
// The bucket's own limits (0032): what the venue display can show, and under
// the 4.5MB request body a Server Action accepts.
const BUCKET_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const BUCKET_MAX_BYTES = 4 * 1024 * 1024;

/** imageUpload, narrowed to what the sponsor-creatives bucket accepts. */
function sponsorImage(value: FormDataEntryValue | null, name: string, tooBig: string) {
  const upload = imageUpload(value, name);
  const invalid = (message: string) => new ValidationError(message, { [name]: [message] });
  if (!BUCKET_TYPES.has(upload.file.type))
    throw invalid("Please upload a JPEG, PNG or WebP image.");
  if (upload.file.size > BUCKET_MAX_BYTES) throw invalid(tooBig);
  return upload;
}

async function ownedSponsor(sponsorId: string, organizationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sponsors")
    .select("id")
    .eq("id", sponsorId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? supabase : null;
}

const NOT_OURS = "That sponsor doesn't belong to your organization.";
const CATEGORY_TAKEN =
  "Another sponsor holds that category exclusively at an event this sponsor is part of.";

export async function createSponsor(formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { organizationId } = await requireOrgManager();
    const f = parseForm(SponsorForm, formData);
    const supabase = await createClient();
    const { error } = await supabase
      .from("sponsors")
      .insert({ organization_id: organizationId, ...f });
    if (error) throw new Error(error.message);
    revalidatePath("/admin/sponsors");
    return ok();
  });
}

export async function updateSponsor(sponsorId: string, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { organizationId } = await requireOrgManager();
    const f = parseForm(SponsorForm, formData);
    const supabase = await createClient();
    const res = await supabase
      .from("sponsors")
      .update(f)
      .eq("id", sponsorId)
      .eq("organization_id", organizationId)
      .select("id");
    // The database refuses a category another sponsor holds exclusively at
    // one of this sponsor's events (0032).
    if (res.error?.message.includes("sponsor_category_exclusive")) {
      return fail(CATEGORY_TAKEN, { category: [CATEGORY_TAKEN] });
    }
    expectChanged(res, "update the sponsor");
    revalidatePath("/admin/sponsors");
    return ok();
  });
}

export async function toggleSponsorActive(
  sponsorId: string,
  active: boolean,
): Promise<ActionResult> {
  return safeAction(async () => {
    const { organizationId } = await requireOrgManager();
    if (typeof active !== "boolean") return fail("Invalid sponsor status.");
    const supabase = await createClient();
    expectChanged(
      await supabase
        .from("sponsors")
        .update({ active })
        .eq("id", sponsorId)
        .eq("organization_id", organizationId)
        .select("id"),
      "update the sponsor",
    );
    revalidatePath("/admin/sponsors");
    return ok();
  });
}

export async function uploadSponsorLogo(
  sponsorId: string,
  formData: FormData,
): Promise<ActionResult> {
  return safeAction(async () => {
    const { organizationId } = await requireOrgManager();
    const { file, ext } = sponsorImage(formData.get("logo"), "logo", "Logo must be under 4MB.");
    const supabase = await ownedSponsor(sponsorId, organizationId);
    if (!supabase) return fail(NOT_OURS);

    const path = `${sponsorId}/logo-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type });
    if (uploadError) throw new Error(uploadError.message);
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

    expectChanged(
      await supabase
        .from("sponsors")
        .update({ logo_url: data.publicUrl })
        .eq("id", sponsorId)
        .eq("organization_id", organizationId)
        .select("id"),
      "save the logo",
    );
    revalidatePath("/admin/sponsors");
    return ok();
  });
}

export async function uploadSponsorCreative(
  sponsorId: string,
  formData: FormData,
): Promise<ActionResult> {
  return safeAction(async () => {
    const { organizationId } = await requireOrgManager();
    const { file, ext } = sponsorImage(
      formData.get("creative"),
      "creative",
      "Creative must be under 4MB — export a 2160×3840 JPEG or WebP.",
    );
    const supabase = await ownedSponsor(sponsorId, organizationId);
    if (!supabase) return fail(NOT_OURS);

    const path = `${sponsorId}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type });
    if (uploadError) throw new Error(uploadError.message);
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

    const { error } = await supabase
      .from("sponsor_creatives")
      .insert({ sponsor_id: sponsorId, storage_path: path, public_url: data.publicUrl });
    if (error) throw new Error(error.message);
    revalidatePath("/admin/sponsors");
    return ok();
  });
}

export async function toggleCreativeActive(
  creativeId: string,
  active: boolean,
): Promise<ActionResult> {
  return safeAction(async () => {
    await requireOrgManager();
    if (typeof active !== "boolean") return fail("Invalid creative status.");
    const supabase = await createClient();
    // RLS limits this to creatives of the manager's org's sponsors.
    expectChanged(
      await supabase.from("sponsor_creatives").update({ active }).eq("id", creativeId).select("id"),
      "update the creative",
    );
    revalidatePath("/admin/sponsors");
    return ok();
  });
}
