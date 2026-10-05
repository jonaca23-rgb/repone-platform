"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { z } from "zod";
import { expectChanged, requireSignedIn } from "@/lib/auth/guards";
import { getAthleteSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { Constants } from "@/lib/db/supabase.types";
import type { LikeTargetType } from "@/lib/db/database.types";
import { friendlyAthleteWriteError } from "@/lib/db/athleteErrors";
import { field, parseForm } from "@/lib/validation/form";
import { safeAction } from "./safeAction";

const TARGET_TABLE = {
  lift: "athlete_lifts",
  benchmark: "athlete_benchmarks",
  standing: "standings",
} as const satisfies Record<LikeTargetType, string>;

const LikeArgs = z.object({
  athleteId: field.id("Athlete"),
  targetType: field.oneOf(Constants.public.Enums.like_target_type, "like target"),
  targetId: field.id("Liked item"),
});

/**
 * Toggle a like on another athlete's lift, benchmark, or standing (WOD /
 * overall placement). RLS (`can_like`, 0017_athlete_likes_and_roster_add.sql)
 * is the real gate on who may like whom; this checks the target exists and
 * belongs to `athleteId` (the like's denormalized owner), then flips the row.
 */
export async function toggleLike(
  athleteId: string,
  targetType: LikeTargetType,
  targetId: string,
): Promise<ActionResult> {
  return safeAction(async () => {
    const ctx = await requireSignedIn();
    const parsed = LikeArgs.safeParse({ athleteId, targetType, targetId });
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "That like isn't valid.");
    }
    const args = parsed.data;

    const supabase = await createClient();
    const { data: target, error: targetErr } = await supabase
      .from(TARGET_TABLE[args.targetType])
      .select("athlete_id")
      .eq("id", args.targetId)
      .maybeSingle();
    if (targetErr) throw new Error(targetErr.message);
    if (!target || target.athlete_id !== args.athleteId) {
      return fail("That item doesn't exist, or isn't this athlete's.");
    }

    const { data: existing, error: existingErr } = await supabase
      .from("athlete_likes")
      .select("id")
      .eq("liker_user_id", ctx.userId)
      .eq("target_type", args.targetType)
      .eq("target_id", args.targetId)
      .maybeSingle();
    if (existingErr) throw new Error(existingErr.message);

    if (existing) {
      expectChanged(
        await supabase
          .from("athlete_likes")
          .delete()
          .eq("id", existing.id)
          .eq("liker_user_id", ctx.userId)
          .select("id"),
        "remove the like",
      );
    } else {
      const { error } = await supabase.from("athlete_likes").insert({
        liker_user_id: ctx.userId,
        athlete_id: args.athleteId,
        target_type: args.targetType,
        target_id: args.targetId,
      });
      if (error) throw new Error(error.message);
    }

    revalidatePath(`/athlete/directory/${args.athleteId}`);
    revalidatePath("/athlete");
    return ok();
  });
}

const NewAthleteForm = z.object({
  first_name: field.text("First name", { max: 100 }),
  last_name: field.text("Last name", { max: 100 }),
  affiliate: field.optionalText({ max: 200, label: "Affiliate" }),
  email: field.email(),
  phone: field.phone(),
});

/**
 * "Add New Athlete" from the athlete portal — a bare roster entry (name +
 * affiliate) in the current athlete's own organization. Insert-only RLS
 * ("athlete add org roster athlete", 0017) means this can never edit or
 * delete an existing athlete, only add a new one.
 */
export async function createAthleteFromPortal(
  formData: FormData,
): Promise<ActionResult<{ href: string }>> {
  return safeAction(async () => {
    await requireSignedIn();
    const me = await getAthleteSessionContext();
    if (!me?.athleteId || !me.organizationId) {
      return fail("Complete your own athlete profile before adding others.");
    }
    const f = parseForm(NewAthleteForm, formData);

    const supabase = await createClient();
    const { data: created, error } = await supabase
      .from("athletes")
      .insert({ organization_id: me.organizationId, ...f })
      .select("id")
      .single();
    if (error) return fail(friendlyAthleteWriteError(error));

    revalidatePath("/athlete/directory");
    return ok({ href: `/athlete/directory/${created.id}` });
  });
}
