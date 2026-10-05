"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { z } from "zod";
import { expectChanged, NotAuthorizedError, requireSignedIn } from "@/lib/auth/guards";
import { createClient } from "@/lib/db/server";
import { getAthleteSessionContext } from "@/lib/auth/session";
import { LIFT_LABELS, LIFT_NAMES, isTimeLift, type LiftName } from "@/lib/constants/lifts";
import { field, parseArg, parseForm } from "@/lib/validation/form";
import { safeAction } from "./safeAction";

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
  await requireSignedIn();
  const ctx = await getAthleteSessionContext();
  if (!ctx?.athleteId) throw new NotAuthorizedError("Not signed in as an athlete.");
  return ctx.athleteId;
}

// One optional field per lift, named exactly as the lift (the dashboard's inputs).
const liftShape = {} as Record<LiftName, z.ZodType<number | null, unknown>>;
for (const lift of LIFT_NAMES) {
  liftShape[lift] = isTimeLift(lift)
    ? field.clock(LIFT_LABELS[lift], "21:30")
    : field.optionalNumber(LIFT_LABELS[lift], { min: 0, max: 2000 });
}
const LiftsForm = z.object(liftShape);

const BenchmarkForm = z.object({
  name: field.text("Benchmark name", { max: 100 }),
  result_display: field.text("Benchmark result", { max: 100 }),
});

type LiftRow =
  | { athlete_id: string; lift: LiftName; weight_lbs: number }
  | { athlete_id: string; lift: LiftName; time_seconds: number };

/**
 * Saves every basic-lift input on the dashboard's edit form in one submit;
 * blank fields are left untouched — same behavior as the admin version.
 */
export async function saveMyLifts(formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const athleteId = await requireOwnAthleteId();
    const values = parseForm(LiftsForm, formData);

    const rows: LiftRow[] = [];
    for (const lift of LIFT_NAMES) {
      const value = values[lift];
      if (value === null) continue;
      rows.push(
        isTimeLift(lift)
          ? { athlete_id: athleteId, lift, time_seconds: value }
          : { athlete_id: athleteId, lift, weight_lbs: value },
      );
    }

    if (rows.length === 0) return fail("Enter at least one lift or time to save.");

    const supabase = await createClient();
    const { error } = await supabase
      .from("athlete_lifts")
      .upsert(rows, { onConflict: "athlete_id,lift" });
    if (error) throw new Error(error.message);

    revalidatePath("/athlete");
    return ok();
  });
}

export async function upsertMyBenchmark(formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const athleteId = await requireOwnAthleteId();
    const { name, result_display } = parseForm(BenchmarkForm, formData);

    const supabase = await createClient();
    const { error } = await supabase
      .from("athlete_benchmarks")
      .upsert({ athlete_id: athleteId, name, result_display }, { onConflict: "athlete_id,name" });
    if (error) throw new Error(error.message);

    revalidatePath("/athlete");
    return ok();
  });
}

export async function deleteMyBenchmark(benchmarkId: string): Promise<ActionResult> {
  return safeAction(async () => {
    const athleteId = await requireOwnAthleteId();
    parseArg(field.id("Benchmark"), benchmarkId);

    const supabase = await createClient();
    // The athlete_id filter scopes the delete to the caller's own rows (RLS's
    // ownership check on athlete_benchmarks backs it up), and expectChanged
    // turns a forged or stale id into an error instead of a silent no-op.
    expectChanged(
      await supabase
        .from("athlete_benchmarks")
        .delete()
        .eq("id", benchmarkId)
        .eq("athlete_id", athleteId)
        .select("id"),
      "remove the benchmark",
    );
    revalidatePath("/athlete");
    return ok();
  });
}
