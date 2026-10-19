"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { requireHeatAccess } from "@/lib/auth/guards";
import { createClient } from "@/lib/db/server";
import { field, parseForm } from "@/lib/validation/form";
import { safeAction } from "./safeAction";

// A lane holds an athlete in an individual division, or a team in a team
// division (0036). The form posts whichever the heat's division takes;
// blank ("— empty —") clears the lane.
const LaneForm = z.object({
  athlete_id: field.optionalId("Athlete"),
  team_id: field.optionalId("Team"),
});

/**
 * Assigns (or clears) one lane's athlete or team. Every expected refusal is
 * a result, not a throw: Jonathan asked for a proper message naming the
 * conflicting heat/category instead of a crash screen.
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
    const { athlete_id, team_id } = parseForm(LaneForm, formData);

    const supabase = await createClient();
    const { data: division, error: divisionError } = await supabase
      .from("divisions")
      .select("name, entry_format")
      .eq("id", heat.division_id)
      .maybeSingle();
    if (divisionError) return fail(divisionError.message);
    const forTeams = !!division && division.entry_format !== "individual";
    if (forTeams && athlete_id) return fail("This heat's division is for teams. Choose a team.");
    if (!forTeams && team_id) {
      return fail("This heat's division is for individuals. Choose an athlete.");
    }

    const column = forTeams ? "team_id" : "athlete_id";
    const competitorId = forTeams ? team_id : athlete_id;
    const noun = forTeams ? "team" : "athlete";

    if (competitorId) {
      // Only competitors registered in this heat's event and division can take
      // a lane (the same list the lane dropdown offers).
      const { data: registration, error: registrationError } = await supabase
        .from("registrations")
        .select("id")
        .eq("event_id", heat.event_id)
        .eq("division_id", heat.division_id)
        .eq(column, competitorId)
        .limit(1)
        .maybeSingle();
      if (registrationError) return fail(registrationError.message);
      if (!registration) return fail(`That ${noun} isn't registered in this heat's division.`);

      // One lane per competitor per WOD and division: a second lane in this
      // heat, or a lane in another heat of the same WOD + division, is always
      // a mistake (it crashed the Score Keeper screen and let someone score
      // twice for one WOD).
      const { data: conflictLanes, error: conflictError } = await supabase
        .from("lanes")
        .select("lane_number, heat_id, heats!inner(heat_number, wod_id, division_id)")
        .eq(column, competitorId)
        .eq("heats.wod_id", heat.wod_id)
        .eq("heats.division_id", heat.division_id)
        .neq("id", laneId);
      if (conflictError) return fail(conflictError.message);

      const conflict = conflictLanes?.[0];
      if (conflict) {
        const categoryName = division?.name ?? "this division";
        if (forTeams) {
          return fail(
            conflict.heat_id === heatId
              ? `This team is already in Lane ${conflict.lane_number} of this heat (${categoryName}) — remove it from that lane first.`
              : `This team is already in Heat ${conflict.heats.heat_number}, Lane ${conflict.lane_number} (${categoryName}) — remove it from there first.`,
          );
        }
        return fail(
          conflict.heat_id === heatId
            ? `This athlete is already assigned to Lane ${conflict.lane_number} in this heat (${categoryName}) — remove them from that lane first.`
            : `This athlete is already registered in another heat/category — Heat ${conflict.heats.heat_number}, Lane ${conflict.lane_number} (${categoryName}) — remove them from there first.`,
        );
      }
    }

    // A lane holds one occupant: writing one kind clears the other.
    // lanes has no event_id: scope to the heat, which was checked against the event above.
    const { data: updated, error } = await supabase
      .from("lanes")
      .update({
        athlete_id: forTeams ? null : competitorId,
        team_id: forTeams ? competitorId : null,
      })
      .eq("id", laneId)
      .eq("heat_id", heatId)
      .select("id");
    if (error) {
      // 23505 = unique_violation — the DB-level backstop from
      // 0012_prevent_duplicate_lane_and_registration_assignments.sql /
      // 0013_prevent_cross_heat_duplicate_lane_assignment.sql catching a race
      // the check above missed.
      if (error.code === "23505") {
        return fail(`This ${noun} is already in another lane or heat for this category.`);
      }
      return fail(error.message);
    }
    if (!updated?.length) return fail("Couldn't save the lane: not found, or not yours.");

    revalidatePath(`/admin/events/${eventId}/heats/${heatId}`);
    return ok();
  });
}
