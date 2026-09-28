"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import type { LikeTargetType } from "@/lib/db/database.types";
import { friendlyAthleteWriteError, nullIfBlank, requireEmail } from "@/lib/db/athleteErrors";

/**
 * Toggle a like on another athlete's lift, benchmark, or standing (WOD /
 * overall placement). RLS (`can_like`, 0017_athlete_likes_and_roster_add.sql)
 * is the real gate — this just resolves the current user and flips the row.
 */
export async function toggleLike(athleteId: string, targetType: LikeTargetType, targetId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: existing } = await supabase
    .from("athlete_likes")
    .select("id")
    .eq("liker_user_id", user.id)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .maybeSingle();

  if (existing) {
    await supabase.from("athlete_likes").delete().eq("id", existing.id);
  } else {
    const { error } = await supabase.from("athlete_likes").insert({
      liker_user_id: user.id,
      athlete_id: athleteId,
      target_type: targetType,
      target_id: targetId,
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/athlete/directory/${athleteId}`);
  revalidatePath("/athlete");
}

/**
 * "Add New Athlete" from the athlete portal — a bare roster entry (name +
 * affiliate) in the current athlete's own organization. Insert-only RLS
 * ("athlete add org roster athlete", 0017) means this can never edit or
 * delete an existing athlete, only add a new one.
 */
export async function createAthleteFromPortal(formData: FormData) {
  const first_name = String(formData.get("first_name") ?? "").trim();
  const last_name = String(formData.get("last_name") ?? "").trim();
  if (!first_name || !last_name) throw new Error("First and last name are required.");
  const affiliate = nullIfBlank(formData.get("affiliate"));
  const email = requireEmail(formData.get("email"));
  const phone = nullIfBlank(formData.get("phone"));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: me } = await supabase
    .from("athletes")
    .select("organization_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!me) throw new Error("Complete your own athlete profile before adding others.");

  const { data: created, error } = await supabase
    .from("athletes")
    .insert({ organization_id: me.organization_id, first_name, last_name, affiliate, email, phone })
    .select("id")
    .single();
  if (error) throw new Error(friendlyAthleteWriteError(error));

  revalidatePath("/athlete/directory");
  redirect(`/athlete/directory/${created.id}`);
}
