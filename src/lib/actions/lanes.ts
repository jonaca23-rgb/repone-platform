"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";

/**
 * Assigns (or clears) one lane's athlete. Returns `{ error }` instead of
 * throwing so it plugs into `useActionState` (see LaneAssignmentForm.tsx) —
 * a thrown error here used to surface as Next's full-page/dev error overlay
 * with no way back to the heat, instead of a normal, dismissable message.
 * Jonathan asked for a proper alert naming the conflicting heat/category
 * instead of that crash screen.
 */
export async function assignLane(
  eventId: string,
  heatId: string,
  laneId: string,
  _prevState: { error: string },
  formData: FormData
): Promise<{ error: string }> {
  const athlete_id = String(formData.get("athlete_id") ?? "") || null;

  const supabase = await createClient();

  // Nothing previously stopped the same athlete being picked for two lanes
  // (the dropdown lists every registrant regardless of who else already has
  // them assigned) — that produced two lanes with the same athlete_id, which
  // crashed the Score Keeper screen with a duplicate-key error and, worse,
  // meant the same person could score twice for one WOD. The check below
  // covers both ways that can happen: a second lane in *this* heat, and a
  // lane in a *different* heat for the same WOD + division (an athlete only
  // ever runs one heat per WOD/division — a second one is always a mistake,
  // never a legitimate double-entry).
  if (athlete_id) {
    const { data: thisHeat } = await supabase
      .from("heats")
      .select("heat_number, wod_id, division_id, divisions(name)")
      .eq("id", heatId)
      .single();
    const thisHeatTyped = thisHeat as unknown as {
      heat_number: number;
      wod_id: string;
      division_id: string;
      divisions: { name: string } | null;
    } | null;

    if (thisHeatTyped) {
      const { data: conflictLanes } = await supabase
        .from("lanes")
        .select("lane_number, heat_id, heats!inner(heat_number, wod_id, division_id)")
        .eq("athlete_id", athlete_id)
        .eq("heats.wod_id", thisHeatTyped.wod_id)
        .eq("heats.division_id", thisHeatTyped.division_id)
        .neq("id", laneId);
      const conflict = (conflictLanes as unknown as Array<{
        lane_number: number;
        heat_id: string;
        heats: { heat_number: number };
      }> | null)?.[0];

      if (conflict) {
        const categoryName = thisHeatTyped.divisions?.name ?? "this division";
        const message =
          conflict.heat_id === heatId
            ? `This athlete is already assigned to Lane ${conflict.lane_number} in this heat (${categoryName}) — remove them from that lane first.`
            : `This athlete is already registered in another heat/category — Heat ${conflict.heats.heat_number}, Lane ${conflict.lane_number} (${categoryName}) — remove them from there first.`;
        return { error: message };
      }
    }
  }

  const { error } = await supabase.from("lanes").update({ athlete_id }).eq("id", laneId);
  if (error) {
    // 23505 = unique_violation — the DB-level backstop from
    // 0012_prevent_duplicate_lane_and_registration_assignments.sql /
    // 0013_prevent_cross_heat_duplicate_lane_assignment.sql catching a race
    // the check above missed.
    if (error.code === "23505") {
      return { error: "This athlete is already registered in another lane/heat for this category." };
    }
    return { error: error.message };
  }

  revalidatePath(`/admin/events/${eventId}/heats/${heatId}`);
  return { error: "" };
}
