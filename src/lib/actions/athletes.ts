"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { expectChanged, requireOrgManager } from "@/lib/auth/guards";
import { createClient } from "@/lib/db/server";
import { Constants } from "@/lib/db/supabase.types";
import { LIFT_LABELS, LIFT_NAMES, isTimeLift, type LiftName } from "@/lib/constants/lifts";
import { parseClockToSeconds } from "@/lib/timer/compute";
import { friendlyAthleteWriteError } from "@/lib/db/athleteErrors";
import { field, imageUpload, parseForm } from "@/lib/validation/form";

// Everything here is the staff-side roster (/admin/athletes): org managers
// only. The athlete's own edits go through lib/actions/myLifts.ts, which
// resolves the athlete from the session instead of taking an id.

const AthleteForm = z.object({
  first_name: field.text("First name", { max: 100 }),
  last_name: field.text("Last name", { max: 100 }),
  affiliate: field.optionalText({ max: 200, label: "Affiliate" }),
  date_of_birth: field.optionalDate("Date of birth"),
  // "" (the "—" option) means not set.
  gender: z
    .preprocess(
      (v) => (v === "" ? undefined : v),
      field.oneOf(Constants.public.Enums.athlete_gender, "gender").optional(),
    )
    .transform((v) => v ?? null),
  email: field.email(),
  phone: field.optionalText({ max: 40, label: "Phone" }),
});

const BenchmarkForm = z.object({
  name: field.text("Benchmark name", { max: 100 }),
  result_display: field.text("Benchmark result", { max: 100 }),
});

// One optional text input per lift; parsed per kind (weight vs. mm:ss) below.
const LiftsForm = z.object(
  Object.fromEntries(
    LIFT_NAMES.map((lift) => [lift, field.optionalText({ max: 20, label: LIFT_LABELS[lift] })]),
  ) as Record<LiftName, ReturnType<typeof field.optionalText>>,
);

const MAX_LIFT_LBS = 2000;

/** The athlete must be on this organization's roster. */
async function requireOwnedAthlete(
  supabase: Awaited<ReturnType<typeof createClient>>,
  athleteId: string,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("athletes")
    .select("id")
    .eq("id", athleteId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("That athlete isn't on your organization's roster.");
  return data.id;
}

export async function createAthlete(formData: FormData) {
  const { organizationId } = await requireOrgManager();
  const f = parseForm(AthleteForm, formData);

  const supabase = await createClient();
  const { error } = await supabase
    .from("athletes")
    .insert({ organization_id: organizationId, ...f });
  if (error) throw new Error(friendlyAthleteWriteError(error));

  revalidatePath("/admin/athletes");
}

export async function updateAthleteProfile(athleteId: string, formData: FormData) {
  const { organizationId } = await requireOrgManager();
  const f = parseForm(AthleteForm, formData);

  const supabase = await createClient();
  const res = await supabase
    .from("athletes")
    .update(f)
    .eq("id", athleteId)
    .eq("organization_id", organizationId)
    .select("id");
  if (res.error) throw new Error(friendlyAthleteWriteError(res.error));
  expectChanged(res, "save the athlete");

  revalidatePath("/admin/athletes");
  revalidatePath(`/admin/athletes/${athleteId}`);
}

export async function deleteAthlete(athleteId: string) {
  const { organizationId } = await requireOrgManager();
  const supabase = await createClient();
  expectChanged(
    await supabase
      .from("athletes")
      .delete()
      .eq("id", athleteId)
      .eq("organization_id", organizationId)
      .select("id"),
    "delete the athlete",
  );
  revalidatePath("/admin/athletes");
}

/**
 * Saves every basic-lift input on the athlete detail page in one submit;
 * blank fields are left untouched. Most lifts are a weight (lbs); the three
 * run benchmarks (400m/1 Mile/5K — see TIME_LIFT_NAMES) are a judge-style
 * mm:ss time instead, parsed the same way the WOD results forms already do.
 */
export async function saveAthleteLifts(athleteId: string, formData: FormData) {
  const { organizationId } = await requireOrgManager();
  const f = parseForm(LiftsForm, formData);

  type LiftRow =
    | { athlete_id: string; lift: LiftName; weight_lbs: number }
    | { athlete_id: string; lift: LiftName; time_seconds: number };
  const rows: LiftRow[] = [];
  for (const lift of LIFT_NAMES) {
    const raw = f[lift];
    if (!raw) continue;
    const label = LIFT_LABELS[lift];
    if (isTimeLift(lift)) {
      const time_seconds = parseClockToSeconds(raw);
      if (time_seconds == null) throw new Error(`${label} must be a time like mm:ss.`);
      rows.push({ athlete_id: athleteId, lift, time_seconds });
    } else {
      const weight_lbs = Number(raw);
      if (!Number.isFinite(weight_lbs) || weight_lbs < 0 || weight_lbs > MAX_LIFT_LBS) {
        throw new Error(`${label} must be a weight between 0 and ${MAX_LIFT_LBS} lbs.`);
      }
      rows.push({ athlete_id: athleteId, lift, weight_lbs });
    }
  }

  if (rows.length === 0) return;

  const supabase = await createClient();
  await requireOwnedAthlete(supabase, athleteId, organizationId);
  const { error } = await supabase
    .from("athlete_lifts")
    .upsert(rows, { onConflict: "athlete_id,lift" });
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/athletes/${athleteId}`);
}

export async function upsertAthleteBenchmark(athleteId: string, formData: FormData) {
  const { organizationId } = await requireOrgManager();
  const { name, result_display } = parseForm(BenchmarkForm, formData);

  const supabase = await createClient();
  const ownedId = await requireOwnedAthlete(supabase, athleteId, organizationId);
  const { error } = await supabase
    .from("athlete_benchmarks")
    .upsert({ athlete_id: ownedId, name, result_display }, { onConflict: "athlete_id,name" });
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/athletes/${athleteId}`);
}

export async function deleteAthleteBenchmark(athleteId: string, benchmarkId: string) {
  const { organizationId } = await requireOrgManager();
  const supabase = await createClient();
  const ownedId = await requireOwnedAthlete(supabase, athleteId, organizationId);
  expectChanged(
    await supabase
      .from("athlete_benchmarks")
      .delete()
      .eq("id", benchmarkId)
      .eq("athlete_id", ownedId)
      .select("id"),
    "remove the benchmark",
  );
  revalidatePath(`/admin/athletes/${athleteId}`);
}

/**
 * Uploads a profile photo to the `athlete-photos` storage bucket (see
 * 0005_athlete_photos_storage.sql) and points athletes.photo_url at it.
 * This is just the storage/display layer — matching photos against event
 * recordings/IG history for highlight clips is future scope, not built here.
 */
export async function uploadAthletePhoto(athleteId: string, formData: FormData) {
  const { organizationId } = await requireOrgManager();

  const { file, ext } = imageUpload(formData.get("photo"));

  const supabase = await createClient();
  // Check ownership before writing to storage, not just before the row update.
  const ownedId = await requireOwnedAthlete(supabase, athleteId, organizationId);
  const path = `${ownedId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("athlete-photos")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicUrlData } = supabase.storage.from("athlete-photos").getPublicUrl(path);

  expectChanged(
    await supabase
      .from("athletes")
      .update({ photo_url: publicUrlData.publicUrl })
      .eq("id", ownedId)
      .eq("organization_id", organizationId)
      .select("id"),
    "save the photo",
  );

  revalidatePath("/admin/athletes");
  revalidatePath(`/admin/athletes/${athleteId}`);
}

export async function removeAthletePhoto(athleteId: string) {
  const { organizationId } = await requireOrgManager();
  const supabase = await createClient();
  expectChanged(
    await supabase
      .from("athletes")
      .update({ photo_url: null })
      .eq("id", athleteId)
      .eq("organization_id", organizationId)
      .select("id"),
    "remove the photo",
  );

  revalidatePath("/admin/athletes");
  revalidatePath(`/admin/athletes/${athleteId}`);
}
