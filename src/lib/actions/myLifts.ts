"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { getAthleteSessionContext } from "@/lib/auth/session";
import { LIFT_NAMES, isTimeLift, type LiftName } from "@/lib/constants/lifts";
import { parseClockToSeconds } from "@/lib/timer/compute";

// Self-service counterparts to lib/actions/athletes.ts's saveAthleteLifts/
// upsertAthleteBenchmark/deleteAthleteBenchmark — same save logic, but for
// the athlete's own dashboard (/athlete) instead of the admin athlete
// detail page. Deliberately never take an athleteId from the caller: every
// action here resolves the athlete to write to from the signed-in session
// itself (getAthleteSessionContext), so there's no form field a browser
// devtools edit could point at someone else's rows. RLS
// (0022_athlete_self_lift_edit.sql) backs this up independently either way,
// but this way a bug here can't even attempt a write it shouldn't.

async function requireOwnAthleteId(): Promise<string> {
  const ctx = await getAthleteSessionContext();
  if (!ctx?.athleteId) throw new Error("Not signed in as an athlete.");
  return ctx.athleteId;
}

/**
 * Saves every basic-lift input on the dashboard's edit form in one submit;
 * blank fields are left untouched — same behavior as the admin version.
 */
export async function saveMyLifts(formData: FormData) {
  const athleteId = await requireOwnAthleteId();

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

  revalidatePath("/athlete");
}

export async function upsertMyBenchmark(formData: FormData) {
  const athleteId = await requireOwnAthleteId();

  const name = String(formData.get("name") ?? "").trim();
  const result_display = String(formData.get("result_display") ?? "").trim();
  if (!name || !result_display) throw new Error("Benchmark name and result are required.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("athlete_benchmarks")
    .upsert({ athlete_id: athleteId, name, result_display }, { onConflict: "athlete_id,name" });
  if (error) throw new Error(error.message);

  revalidatePath("/athlete");
}

export async function deleteMyBenchmark(benchmarkId: string) {
  const athleteId = await requireOwnAthleteId();

  const supabase = await createClient();
  // athlete_id filter here isn't just belt-and-suspenders against a forged
  // benchmarkId — RLS's own athlete_id ownership check on athlete_benchmarks
  // already stops that — it's what keeps this delete from silently no-op'ing
  // vs. erroring the same way as any other "not yours" attempt.
  await supabase.from("athlete_benchmarks").delete().eq("id", benchmarkId).eq("athlete_id", athleteId);
  revalidatePath("/athlete");
}
