"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { requireHeatAccess } from "@/lib/auth/guards";
import { createClient } from "@/lib/db/server";
import { field, parseForm } from "@/lib/validation/form";
import { safeAction } from "./safeAction";

// Blank ("— empty —") clears the lane.
const LaneForm = z.object({ athlete_id: field.optionalId("Athlete") });

/**
 * Assigns (or clears) one lane's athlete. Every expected refusal is a result,
 * not a throw: Jonathan asked for a proper message naming the conflicting
 * heat/category instead of a crash screen.
 */
export async function assignLane(
  eventId: string,
  heatId: string,
  laneId: string,
  formData: FormData,
): Promise<ActionResult> {
  return safeAction(async () => {
    const { heat } = await requireHeatAccess(heatId, []);
    if (heat.event_id !== eventId) return fail("That heat isn't part of this event.");
    const { athlete_id } = parseForm(LaneForm, formData);

    const supabase = await createClient();

    if (athlete_id) {
      // Only athletes registered in this heat's event and division can take a lane
      // (the same list the lane dropdown offers).
      const { data: registration, error: registrationError } = await supabase
        .from("registrations")
        .select("id")
        .eq("event_id", heat.event_id)
        .eq("division_id", heat.division_id)
        .eq("athlete_id", athlete_id)
        .limit(1)
        .maybeSingle();
      if (registrationError) return fail(registrationError.message);
      if (!registration) return fail("That athlete isn't registered in this heat's division.");

      // Nothing previously stopped the same athlete being picked for two lanes
      // (the dropdown lists every registrant regardless of who else already has
      // them assigned) — that produced two lanes with the same athlete_id, which
      // crashed the Score Keeper screen with a duplicate-key error and, worse,
      // meant the same person could score twice for one WOD. The check below
      // covers both ways that can happen: a second lane in *this* heat, and a
      // lane in a *different* heat for the same WOD + division (an athlete only
      // ever runs one heat per WOD/division — a second one is always a mistake,
      // never a legitimate double-entry).
      const [
        { data: division, error: divisionError },
        { data: conflictLanes, error: conflictError },
      ] = await Promise.all([
        supabase.from("divisions").select("name").eq("id", heat.division_id).maybeSingle(),
        supabase
          .from("lanes")
          .select("lane_number, heat_id, heats!inner(heat_number, wod_id, division_id)")
          .eq("athlete_id", athlete_id)
          .eq("heats.wod_id", heat.wod_id)
          .eq("heats.division_id", heat.division_id)
          .neq("id", laneId),
      ]);
      if (divisionError) return fail(divisionError.message);
      if (conflictError) return fail(conflictError.message);

      const conflict = conflictLanes?.[0];
      if (conflict) {
        const categoryName = division?.name ?? "this division";
        const message =
          conflict.heat_id === heatId
            ? `This athlete is already assigned to Lane ${conflict.lane_number} in this heat (${categoryName}) — remove them from that lane first.`
            : `This athlete is already registered in another heat/category — Heat ${conflict.heats.heat_number}, Lane ${conflict.lane_number} (${categoryName}) — remove them from there first.`;
        return fail(message);
      }
    }

    // lanes has no event_id: scope to the heat, which was checked against the event above.
    const { data: updated, error } = await supabase
      .from("lanes")
      .update({ athlete_id })
      .eq("id", laneId)
      .eq("heat_id", heatId)
      .select("id");
    if (error) {
      // 23505 = unique_violation — the DB-level backstop from
      // 0012_prevent_duplicate_lane_and_registration_assignments.sql /
      // 0013_prevent_cross_heat_duplicate_lane_assignment.sql catching a race
      // the check above missed.
      if (error.code === "23505") {
        return fail("This athlete is already registered in another lane/heat for this category.");
      }
      return fail(error.message);
    }
    if (!updated?.length) return fail("Couldn't save the lane: not found, or not yours.");

    revalidatePath(`/admin/events/${eventId}/heats/${heatId}`);
    return ok();
  });
}
