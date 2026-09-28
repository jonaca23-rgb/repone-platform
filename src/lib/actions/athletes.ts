"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { getSessionContext } from "@/lib/auth/session";
import { LIFT_NAMES, isTimeLift, type LiftName } from "@/lib/constants/lifts";
import { parseClockToSeconds } from "@/lib/timer/compute";
import { friendlyAthleteWriteError, nullIfBlank, requireEmail } from "@/lib/db/athleteErrors";

function readGender(formData: FormData): "male" | "female" | null {
  const raw = String(formData.get("gender") ?? "");
  return raw === "male" || raw === "female" ? raw : null;
}

export async function createAthlete(formData: FormData) {
  const ctx = await getSessionContext();
  if (!ctx?.organizationId) throw new Error("No organization on this account yet.");

  const first_name = String(formData.get("first_name") ?? "").trim();
  const last_name = String(formData.get("last_name") ?? "").trim();
  const affiliate = String(formData.get("affiliate") ?? "") || null;
  const date_of_birth = String(formData.get("date_of_birth") ?? "") || null;
  const gender = readGender(formData);
  const email = requireEmail(formData.get("email"));
  const phone = nullIfBlank(formData.get("phone"));
  if (!first_name || !last_name) throw new Error("First and last name are required.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("athletes")
    .insert({ organization_id: ctx.organizationId, first_name, last_name, affiliate, date_of_birth, gender, email, phone });
  if (error) throw new Error(friendlyAthleteWriteError(error));

  revalidatePath("/admin/athletes");
}

export async function updateAthleteProfile(athleteId: string, formData: FormData) {
  const first_name = String(formData.get("first_name") ?? "").trim();
  const last_name = String(formData.get("last_name") ?? "").trim();
  const affiliate = String(formData.get("affiliate") ?? "") || null;
  const date_of_birth = String(formData.get("date_of_birth") ?? "") || null;
  const gender = readGender(formData);
  const email = requireEmail(formData.get("email"));
  const phone = nullIfBlank(formData.get("phone"));
  if (!first_name || !last_name) throw new Error("First and last name are required.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("athletes")
    .update({ first_name, last_name, affiliate, date_of_birth, gender, email, phone })
    .eq("id", athleteId);
  if (error) throw new Error(friendlyAthleteWriteError(error));

  revalidatePath("/admin/athletes");
  revalidatePath(`/admin/athletes/${athleteId}`);
}

export async function deleteAthlete(athleteId: string) {
  const supabase = await createClient();
  await supabase.from("athletes").delete().eq("id", athleteId);
  revalidatePath("/admin/athletes");
}

/**
 * Saves every basic-lift input on the athlete detail page in one submit;
 * blank fields are left untouched. Most lifts are a weight (lbs); the three
 * run benchmarks (400m/1 Mile/5K — see TIME_LIFT_NAMES) are a judge-style
 * mm:ss time instead, parsed the same way the WOD results forms already do.
 */
export async function saveAthleteLifts(athleteId: string, formData: FormData) {
  const rows = LIFT_NAMES.map((lift) => {
    const raw = String(formData.get(lift) ?? "").trim();
    if (!raw) return null;
    if (isTimeLift(lift)) {
      const time_seconds = parseClockToSeconds(raw);
      if (time_seconds == null) return null;
      return { athlete_id: athleteId, lift, time_seconds };
    }
    const weight_lbs = Number(raw);
    if (Number.isNaN(weight_lbs)) return null;
    return { athlete_id: athleteId, lift, weight_lbs };
  }).filter(
    (r): r is { athlete_id: string; lift: LiftName; weight_lbs: number } | { athlete_id: string; lift: LiftName; time_seconds: number } =>
      r !== null
  );

  if (rows.length === 0) return;

  const supabase = await createClient();
  const { error } = await supabase.from("athlete_lifts").upsert(rows, { onConflict: "athlete_id,lift" });
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/athletes/${athleteId}`);
}

export async function upsertAthleteBenchmark(athleteId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const result_display = String(formData.get("result_display") ?? "").trim();
  if (!name || !result_display) throw new Error("Benchmark name and result are required.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("athlete_benchmarks")
    .upsert({ athlete_id: athleteId, name, result_display }, { onConflict: "athlete_id,name" });
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/athletes/${athleteId}`);
}

export async function deleteAthleteBenchmark(athleteId: string, benchmarkId: string) {
  const supabase = await createClient();
  await supabase.from("athlete_benchmarks").delete().eq("id", benchmarkId);
  revalidatePath(`/admin/athletes/${athleteId}`);
}

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

/**
 * Uploads a profile photo to the `athlete-photos` storage bucket (see
 * 0005_athlete_photos_storage.sql) and points athletes.photo_url at it.
 * This is just the storage/display layer — matching photos against event
 * recordings/IG history for highlight clips is future scope, not built here.
 */
export async function uploadAthletePhoto(athleteId: string, formData: FormData) {
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose an image file to upload.");
  if (!file.type.startsWith("image/")) throw new Error("Please upload an image file.");
  if (file.size > MAX_PHOTO_BYTES) throw new Error("Image must be under 8MB.");

  const supabase = await createClient();
  const extMatch = /\.([a-zA-Z0-9]+)$/.exec(file.name);
  const ext = (extMatch?.[1] ?? "jpg").toLowerCase();
  const path = `${athleteId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("athlete-photos")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicUrlData } = supabase.storage.from("athlete-photos").getPublicUrl(path);

  const { error } = await supabase
    .from("athletes")
    .update({ photo_url: publicUrlData.publicUrl })
    .eq("id", athleteId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/athletes");
  revalidatePath(`/admin/athletes/${athleteId}`);
}

export async function removeAthletePhoto(athleteId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("athletes").update({ photo_url: null }).eq("id", athleteId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/athletes");
  revalidatePath(`/admin/athletes/${athleteId}`);
}
