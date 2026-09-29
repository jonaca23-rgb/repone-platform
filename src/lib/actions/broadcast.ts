"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { getSessionContext } from "@/lib/auth/session";
import { computeElapsedSeconds } from "@/lib/timer/compute";
import type { ActiveGraphic, TimerDirection } from "@/lib/db/database.types";

async function logAction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string | null,
  floorId: string,
  action: string,
  details?: Record<string, unknown>,
) {
  const ctx = await getSessionContext();
  await supabase.from("operator_actions").insert({
    event_id: eventId,
    floor_id: floorId,
    user_id: ctx?.userId ?? null,
    action,
    details: details ?? null,
  });
}

/** Operator selects WOD -> Heat: this one write prepares every downstream graphic. */
export async function setCurrentHeat(floorId: string, heatId: string, eventId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("broadcast_state")
    .update({ current_heat_id: heatId })
    .eq("floor_id", floorId);
  if (error) throw new Error(error.message);
  await logAction(supabase, eventId, floorId, "heat_change", { heatId });
  revalidatePath("/dashboard");
}

export async function setActiveGraphic(
  floorId: string,
  graphic: ActiveGraphic,
  eventId: string | null,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("broadcast_state")
    .update({ active_graphic: graphic })
    .eq("floor_id", floorId);
  if (error) throw new Error(error.message);
  await logAction(supabase, eventId, floorId, "graphic_show", { graphic });
}

export async function setLowerThird(
  floorId: string,
  athleteId: string | null,
  eventId: string | null,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("broadcast_state")
    .update({
      lower_third_athlete_id: athleteId,
      active_graphic: athleteId ? "lower_third" : "none",
    })
    .eq("floor_id", floorId);
  if (error) throw new Error(error.message);
  await logAction(supabase, eventId, floorId, athleteId ? "lower_third_show" : "lower_third_hide", {
    athleteId,
  });
}

export async function setActiveSponsor(
  floorId: string,
  sponsorId: string | null,
  eventId: string | null,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("broadcast_state")
    .update({ active_sponsor_id: sponsorId, active_graphic: sponsorId ? "sponsor" : "none" })
    .eq("floor_id", floorId);
  if (error) throw new Error(error.message);
  await logAction(supabase, eventId, floorId, "sponsor_show", { sponsorId });
}

export async function clearGraphics(floorId: string, eventId: string | null) {
  const supabase = await createClient();
  await supabase
    .from("broadcast_state")
    .update({ active_graphic: "none", lower_third_athlete_id: null, active_sponsor_id: null })
    .eq("floor_id", floorId);
  await logAction(supabase, eventId, floorId, "clear_graphics");
}

// ---------------------------------------------------------------------------
// Timer — server-authoritative. See src/lib/timer/compute.ts for the math
// every client (dashboard + overlay) uses to derive the current display value
// from this same anchor, so nothing runs its own independent countdown.
// ---------------------------------------------------------------------------

export async function startTimer(
  floorId: string,
  direction: TimerDirection,
  durationSeconds: number,
  eventId: string | null,
) {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("broadcast_state")
    .update({
      timer_status: "running",
      timer_direction: direction,
      timer_duration_seconds: durationSeconds,
      timer_elapsed_at_anchor: 0,
      timer_anchor_time: nowIso,
      active_graphic: "timer",
    })
    .eq("floor_id", floorId);
  if (error) throw new Error(error.message);
  await logAction(supabase, eventId, floorId, "timer_start", { direction, durationSeconds });
}

export async function pauseTimer(floorId: string, eventId: string | null) {
  const supabase = await createClient();
  const { data: state } = await supabase
    .from("broadcast_state")
    .select(
      "timer_status, timer_direction, timer_duration_seconds, timer_elapsed_at_anchor, timer_anchor_time",
    )
    .eq("floor_id", floorId)
    .single();
  if (!state || state.timer_status !== "running") return;

  const elapsed = computeElapsedSeconds(
    {
      status: "running",
      direction: state.timer_direction,
      durationSeconds: state.timer_duration_seconds,
      elapsedAtAnchor: state.timer_elapsed_at_anchor,
      anchorTimeMs: state.timer_anchor_time ? new Date(state.timer_anchor_time).getTime() : null,
    },
    Date.now(),
  );

  await supabase
    .from("broadcast_state")
    .update({ timer_status: "paused", timer_elapsed_at_anchor: elapsed, timer_anchor_time: null })
    .eq("floor_id", floorId);
  await logAction(supabase, eventId, floorId, "timer_pause", { elapsed });
}

export async function resumeTimer(floorId: string, eventId: string | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("broadcast_state")
    .update({ timer_status: "running", timer_anchor_time: new Date().toISOString() })
    .eq("floor_id", floorId);
  if (error) throw new Error(error.message);
  await logAction(supabase, eventId, floorId, "timer_resume");
}

export async function resetTimer(floorId: string, eventId: string | null) {
  const supabase = await createClient();
  await supabase
    .from("broadcast_state")
    .update({ timer_status: "idle", timer_elapsed_at_anchor: 0, timer_anchor_time: null })
    .eq("floor_id", floorId);
  await logAction(supabase, eventId, floorId, "timer_reset");
}

/** +/- adjustment (in seconds) applied to the timer while preserving running/paused state. */
export async function adjustTimer(floorId: string, deltaSeconds: number, eventId: string | null) {
  const supabase = await createClient();
  const { data: state } = await supabase
    .from("broadcast_state")
    .select(
      "timer_status, timer_direction, timer_duration_seconds, timer_elapsed_at_anchor, timer_anchor_time",
    )
    .eq("floor_id", floorId)
    .single();
  if (!state) return;

  const nowMs = Date.now();
  const currentElapsed = computeElapsedSeconds(
    {
      status: state.timer_status,
      direction: state.timer_direction,
      durationSeconds: state.timer_duration_seconds,
      elapsedAtAnchor: state.timer_elapsed_at_anchor,
      anchorTimeMs: state.timer_anchor_time ? new Date(state.timer_anchor_time).getTime() : null,
    },
    nowMs,
  );

  // For count_down, "+" adds time on the clock (less elapsed); for count_up, "+" adds elapsed.
  const sign = state.timer_direction === "count_down" ? -1 : 1;
  const newElapsed = Math.max(0, currentElapsed + sign * deltaSeconds);

  await supabase
    .from("broadcast_state")
    .update({
      timer_elapsed_at_anchor: newElapsed,
      timer_anchor_time: state.timer_status === "running" ? new Date(nowMs).toISOString() : null,
    })
    .eq("floor_id", floorId);
  await logAction(supabase, eventId, floorId, "timer_adjust", { deltaSeconds });
}
