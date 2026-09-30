"use server";

import { createClient } from "@/lib/db/server";
import { getSessionContext } from "@/lib/auth/session";
import type { ActiveGraphic, Database, Json, TimerDirection } from "@/lib/db/database.types";

type BroadcastStatePatch = Database["public"]["Tables"]["broadcast_state"]["Update"];

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * The operator log is an audit trail, not part of the action: a failed insert
 * is reported on the server but never fails the broadcast change itself.
 */
async function logAction(
  supabase: SupabaseServerClient,
  eventId: string | null,
  floorId: string,
  action: string,
  details?: { [key: string]: Json | undefined },
) {
  const ctx = await getSessionContext();
  const { error } = await supabase.from("operator_actions").insert({
    event_id: eventId,
    floor_id: floorId,
    user_id: ctx?.userId ?? null,
    action,
    details: details ?? null,
  });
  if (error) console.error(`operator_actions insert failed (${action}): ${error.message}`);
}

/**
 * Every write to a floor's broadcast_state goes through here. An update that
 * matches no row (floor without broadcast state, or RLS denying this user)
 * used to "succeed" silently; now the operator sees an error.
 */
async function updateBroadcastState(
  supabase: SupabaseServerClient,
  floorId: string,
  patch: BroadcastStatePatch,
) {
  const { data, error } = await supabase
    .from("broadcast_state")
    .update(patch)
    .eq("floor_id", floorId)
    .select("floor_id");
  if (error) throw new Error(error.message);
  if (!data?.length) {
    throw new Error("This floor's broadcast controls aren't available to your account.");
  }
}

/** Operator selects WOD -> Heat: this one write prepares every downstream graphic. */
export async function setCurrentHeat(floorId: string, heatId: string, eventId: string) {
  const supabase = await createClient();
  await updateBroadcastState(supabase, floorId, { current_heat_id: heatId });
  await logAction(supabase, eventId, floorId, "heat_change", { heatId });
}

export async function setActiveGraphic(
  floorId: string,
  graphic: ActiveGraphic,
  eventId: string | null,
) {
  const supabase = await createClient();
  await updateBroadcastState(supabase, floorId, { active_graphic: graphic });
  await logAction(supabase, eventId, floorId, "graphic_show", { graphic });
}

export async function setLowerThird(
  floorId: string,
  athleteId: string | null,
  eventId: string | null,
) {
  const supabase = await createClient();
  await updateBroadcastState(supabase, floorId, {
    lower_third_athlete_id: athleteId,
    active_graphic: athleteId ? "lower_third" : "none",
  });
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
  await updateBroadcastState(supabase, floorId, {
    active_sponsor_id: sponsorId,
    active_graphic: sponsorId ? "sponsor" : "none",
  });
  await logAction(supabase, eventId, floorId, "sponsor_show", { sponsorId });
}

export async function clearGraphics(floorId: string, eventId: string | null) {
  const supabase = await createClient();
  await updateBroadcastState(supabase, floorId, {
    active_graphic: "none",
    lower_third_athlete_id: null,
    active_sponsor_id: null,
  });
  await logAction(supabase, eventId, floorId, "clear_graphics");
}

// ---------------------------------------------------------------------------
// Timer — server-authoritative. Every transition runs in timer_command()
// (0027_timer_command.sql): one locked row, the database clock, and commands
// that don't apply to the current state (resume while running, pause while
// idle) are no-ops. Clients derive the display from the anchor with
// src/lib/timer/compute.ts; nothing runs its own countdown.
// ---------------------------------------------------------------------------

async function timerCommand(
  floorId: string,
  eventId: string | null,
  command: "start" | "pause" | "resume" | "reset" | "adjust",
  args: {
    p_direction?: TimerDirection;
    p_duration_seconds?: number;
    p_delta_seconds?: number;
  } = {},
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("timer_command", {
    p_floor_id: floorId,
    p_command: command,
    ...args,
  });
  if (error) throw new Error(error.message);
  await logAction(supabase, eventId, floorId, `timer_${command}`, args);
}

export async function startTimer(
  floorId: string,
  direction: TimerDirection,
  durationSeconds: number,
  eventId: string | null,
) {
  await timerCommand(floorId, eventId, "start", {
    p_direction: direction,
    p_duration_seconds: durationSeconds,
  });
}

export async function pauseTimer(floorId: string, eventId: string | null) {
  await timerCommand(floorId, eventId, "pause");
}

export async function resumeTimer(floorId: string, eventId: string | null) {
  await timerCommand(floorId, eventId, "resume");
}

export async function resetTimer(floorId: string, eventId: string | null) {
  await timerCommand(floorId, eventId, "reset");
}

/** +/- adjustment (in seconds) applied to the timer while preserving running/paused state. */
export async function adjustTimer(floorId: string, deltaSeconds: number, eventId: string | null) {
  await timerCommand(floorId, eventId, "adjust", { p_delta_seconds: deltaSeconds });
}
