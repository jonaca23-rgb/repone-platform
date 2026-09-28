"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/db/server";

export async function createHeat(eventId: string, formData: FormData) {
  const floor_id = String(formData.get("floor_id") ?? "");
  const wod_id = String(formData.get("wod_id") ?? "");
  const division_id = String(formData.get("division_id") ?? "");
  const heat_number = Number(formData.get("heat_number") ?? 0);
  const heat_count = Number(formData.get("heat_count") ?? 0) || null;
  const lane_count = Math.max(1, Math.min(20, Number(formData.get("lane_count") ?? 6)));
  const scheduled_start = String(formData.get("scheduled_start") ?? "") || null;

  if (!floor_id || !wod_id || !division_id || !heat_number) {
    throw new Error("Floor, WOD, division, and heat number are required.");
  }

  const supabase = await createClient();
  const { data: heat, error } = await supabase
    .from("heats")
    .insert({ event_id: eventId, floor_id, wod_id, division_id, heat_number, heat_count, scheduled_start })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const laneRows = Array.from({ length: lane_count }, (_, i) => ({
    heat_id: heat.id,
    lane_number: i + 1,
  }));
  await supabase.from("lanes").insert(laneRows);

  revalidatePath(`/admin/events/${eventId}/heats`);
}

export async function deleteHeat(eventId: string, heatId: string) {
  const supabase = await createClient();
  await supabase.from("heats").delete().eq("id", heatId);
  revalidatePath(`/admin/events/${eventId}/heats`);
}

/**
 * Marks a heat as finished — the Score Keeper's own "Save all & Finish
 * Heat" button, clicked once every lane's result for this heat has been
 * entered there (via enterResult, saved one lane at a time as the WOD
 * finishes). This is what flips the heat to "✓ Completed" back on the
 * Heats & Lanes list and moves its "Next Up" highlight along. The Heats &
 * Lanes heat detail page's own "Save All" button (saveHeatResults, in
 * actions/results.ts) is a separate backup/manual-entry path and no longer
 * finishes a heat on its own — only this does.
 */
export async function finishHeat(eventId: string, heatId: string, floorId: string | null) {
  const supabase = await createClient();
  await supabase.from("heats").update({ ended_at: new Date().toISOString() }).eq("id", heatId);

  revalidatePath(`/admin/events/${eventId}/heats`);
  revalidatePath(`/overlay`);
  if (floorId) revalidatePath(`/scorekeeper/${floorId}`);
}

/**
 * Given a Floor/WOD/Division and a lane count, works out how many heats are
 * needed to run every registered athlete/team through (ceil(participants /
 * lanes)), creates that many heat rows, and fills their lanes straight from
 * the `registrations` table (individuals and teams both — whichever a given
 * registration row is for) — so the organizer doesn't have to know the
 * headcount up front or place each competitor into a lane by hand.
 *
 * Participants are assigned in blocks in registration order: the first
 * `lanes_per_heat` registrants fill Heat 1, the next block fills Heat 2, and
 * so on; the final heat's leftover lanes are left empty.
 *
 * Refuses to run if heats already exist for this WOD+division (heat_number
 * is only unique per wod/division, per the schema) — regenerating on top of
 * an existing set could double-book someone into two heats, so the operator
 * is asked to remove the existing heats first (or use "Add Single Heat").
 */
export async function generateHeats(eventId: string, formData: FormData) {
  const floor_id = String(formData.get("floor_id") ?? "");
  const wod_id = String(formData.get("wod_id") ?? "");
  const division_id = String(formData.get("division_id") ?? "");
  const lanes_per_heat = Math.max(1, Math.min(20, Number(formData.get("lanes_per_heat") ?? 6)));
  const scheduled_start = String(formData.get("scheduled_start") ?? "") || null;
  const interval_minutes = Math.max(0, Number(formData.get("interval_minutes") ?? 0) || 0);

  // Remember the lane count as soon as it's read (before any validation can
  // throw) — once the operator has set up e.g. "8 lanes" for this event's
  // floor, every later WOD/division they generate heats for should default
  // to the same count instead of resetting to 6, whether or not this
  // particular generate call succeeds.
  const cookieStore = await cookies();
  cookieStore.set(`repone_lanes_per_heat_${eventId}`, String(lanes_per_heat), {
    maxAge: 60 * 60 * 24 * 180,
    sameSite: "lax",
  });

  if (!floor_id || !wod_id || !division_id) {
    throw new Error("Floor, WOD, and division are required.");
  }

  const supabase = await createClient();

  const { data: existingHeats, error: existingErr } = await supabase
    .from("heats")
    .select("id")
    .eq("wod_id", wod_id)
    .eq("division_id", division_id);
  if (existingErr) throw new Error(existingErr.message);
  if ((existingHeats ?? []).length > 0) {
    throw new Error(
      "Heats already exist for this WOD/Division — remove them first (or use Add Single Heat) before generating a new set, so no one ends up double-booked."
    );
  }

  const { data: registrations, error: regErr } = await supabase
    .from("registrations")
    .select("athlete_id, team_id")
    .eq("event_id", eventId)
    .eq("division_id", division_id)
    .order("created_at");
  if (regErr) throw new Error(regErr.message);

  const participants = (registrations ?? []).filter((r) => r.athlete_id || r.team_id);
  if (participants.length === 0) {
    throw new Error("No registered athletes/teams found for this division — register participants first.");
  }

  const heatCount = Math.ceil(participants.length / lanes_per_heat);
  const baseStart = scheduled_start ? new Date(scheduled_start) : null;

  for (let i = 0; i < heatCount; i++) {
    const heatScheduledStart = baseStart
      ? new Date(baseStart.getTime() + i * interval_minutes * 60_000).toISOString()
      : null;

    const { data: heat, error: heatErr } = await supabase
      .from("heats")
      .insert({
        event_id: eventId,
        floor_id,
        wod_id,
        division_id,
        heat_number: i + 1,
        heat_count: heatCount,
        scheduled_start: heatScheduledStart,
      })
      .select("id")
      .single();
    if (heatErr) throw new Error(heatErr.message);

    const heatParticipants = participants.slice(i * lanes_per_heat, (i + 1) * lanes_per_heat);
    const laneRows = Array.from({ length: lanes_per_heat }, (_, laneIdx) => ({
      heat_id: heat.id,
      lane_number: laneIdx + 1,
      athlete_id: heatParticipants[laneIdx]?.athlete_id ?? null,
      team_id: heatParticipants[laneIdx]?.team_id ?? null,
    }));
    const { error: laneErr } = await supabase.from("lanes").insert(laneRows);
    if (laneErr) throw new Error(laneErr.message);
  }

  revalidatePath(`/admin/events/${eventId}/heats`);
}
