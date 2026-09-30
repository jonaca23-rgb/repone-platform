"use server";

import { z } from "zod";
import { NotAuthorizedError, requireFloorAccess } from "@/lib/auth/guards";
import { createClient } from "@/lib/db/server";
import { Constants } from "@/lib/db/supabase.types";
import type { ActiveGraphic, Database, Json, TimerDirection } from "@/lib/db/database.types";
import { parseArg } from "@/lib/validation/form";

type BroadcastStatePatch = Database["public"]["Tables"]["broadcast_state"]["Update"];

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Every action here is driven from the producer dashboard: an org manager or
// a producer assigned to the floor's event may run it (requireFloorAccess).
// The `eventId` each action still accepts is ignored — the event is resolved
// from the floor on the server and that is what goes into the operator log.
// (It stays in the signatures so the dashboard's calls don't change; hence:)

const Id = (label: string) => z.guid({ error: `${label} is missing or invalid.` });
const Graphic = z.enum(Constants.public.Enums.active_graphic, { error: "Choose a valid graphic." });
const Direction = z.enum(Constants.public.Enums.timer_direction, {
  error: "Choose a valid timer direction.",
});
// A day is far beyond any WOD; the bound just keeps garbage out of the RPC.
const Duration = z
  .number({ error: "Timer duration must be a number." })
  .int("Timer duration must be whole seconds.")
  .min(0, "Timer duration can't be negative.")
  .max(86_400, "Timer duration is too long.");
const Delta = z
  .number({ error: "Timer adjustment must be a number." })
  .int("Timer adjustment must be whole seconds.")
  .min(-86_400, "Timer adjustment is too large.")
  .max(86_400, "Timer adjustment is too large.");

/**
 * The operator log is an audit trail, not part of the action: a failed insert
 * is reported on the server but never fails the broadcast change itself.
 */
async function logAction(
  supabase: SupabaseServerClient,
  userId: string,
  eventId: string,
  floorId: string,
  action: string,
  details?: { [key: string]: Json | undefined },
) {
  const { error } = await supabase.from("operator_actions").insert({
    event_id: eventId,
    floor_id: floorId,
    user_id: userId,
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
export async function setCurrentHeat(floorId: string, heatId: string, _eventId: string) {
  const { ctx, eventId } = await requireFloorAccess(floorId, ["producer"]);
  parseArg(Id("Heat"), heatId);

  const supabase = await createClient();
  const { data: heat, error } = await supabase
    .from("heats")
    .select("id")
    .eq("id", heatId)
    .eq("floor_id", floorId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!heat) throw new NotAuthorizedError("That heat isn't on this floor.");

  await updateBroadcastState(supabase, floorId, { current_heat_id: heatId });
  await logAction(supabase, ctx.userId, eventId, floorId, "heat_change", { heatId });
}

export async function setActiveGraphic(
  floorId: string,
  graphic: ActiveGraphic,
  _eventId: string | null,
) {
  const { ctx, eventId } = await requireFloorAccess(floorId, ["producer"]);
  const active_graphic = parseArg(Graphic, graphic);

  const supabase = await createClient();
  await updateBroadcastState(supabase, floorId, { active_graphic });
  await logAction(supabase, ctx.userId, eventId, floorId, "graphic_show", {
    graphic: active_graphic,
  });
}

export async function setLowerThird(
  floorId: string,
  athleteId: string | null,
  _eventId: string | null,
) {
  const { ctx, eventId } = await requireFloorAccess(floorId, ["producer"]);
  const supabase = await createClient();

  if (athleteId !== null) {
    parseArg(Id("Athlete"), athleteId);
    // Only someone laned in a heat on this floor can be put on screen here.
    const { data: lane, error } = await supabase
      .from("lanes")
      .select("id, heats!inner(floor_id)")
      .eq("athlete_id", athleteId)
      .eq("heats.floor_id", floorId)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!lane) throw new NotAuthorizedError("That athlete isn't in a heat on this floor.");
  }

  await updateBroadcastState(supabase, floorId, {
    lower_third_athlete_id: athleteId,
    active_graphic: athleteId ? "lower_third" : "none",
  });
  await logAction(
    supabase,
    ctx.userId,
    eventId,
    floorId,
    athleteId ? "lower_third_show" : "lower_third_hide",
    { athleteId },
  );
}

export async function setActiveSponsor(
  floorId: string,
  sponsorId: string | null,
  _eventId: string | null,
) {
  const { ctx, eventId, organizationId } = await requireFloorAccess(floorId, ["producer"]);
  const supabase = await createClient();

  if (sponsorId !== null) {
    parseArg(Id("Sponsor"), sponsorId);
    // Same scope the dashboard lists: the event's org, for this event or org-wide.
    const { data: sponsor, error } = await supabase
      .from("sponsors")
      .select("id, event_id")
      .eq("id", sponsorId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sponsor || (sponsor.event_id !== null && sponsor.event_id !== eventId)) {
      throw new NotAuthorizedError("That sponsor isn't part of this event.");
    }
  }

  await updateBroadcastState(supabase, floorId, {
    active_sponsor_id: sponsorId,
    active_graphic: sponsorId ? "sponsor" : "none",
  });
  await logAction(supabase, ctx.userId, eventId, floorId, "sponsor_show", { sponsorId });
}

export async function clearGraphics(floorId: string, _eventId: string | null) {
  const { ctx, eventId } = await requireFloorAccess(floorId, ["producer"]);
  const supabase = await createClient();
  await updateBroadcastState(supabase, floorId, {
    active_graphic: "none",
    lower_third_athlete_id: null,
    active_sponsor_id: null,
  });
  await logAction(supabase, ctx.userId, eventId, floorId, "clear_graphics");
}

// ---------------------------------------------------------------------------
// Timer — server-authoritative. Every transition runs in timer_command()
// (0027_timer_command.sql): one locked row, the database clock, and commands
// that don't apply to the current state (resume while running, pause while
// idle) are no-ops. Clients derive the display from the anchor with
// src/lib/timer/compute.ts; nothing runs its own countdown.
// ---------------------------------------------------------------------------

type FloorAccess = Awaited<ReturnType<typeof requireFloorAccess>>;

async function timerCommand(
  { ctx, eventId, floorId }: FloorAccess,
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
  await logAction(supabase, ctx.userId, eventId, floorId, `timer_${command}`, args);
}

export async function startTimer(
  floorId: string,
  direction: TimerDirection,
  durationSeconds: number,
  _eventId: string | null,
) {
  const access = await requireFloorAccess(floorId, ["producer"]);
  await timerCommand(access, "start", {
    p_direction: parseArg(Direction, direction),
    p_duration_seconds: parseArg(Duration, durationSeconds),
  });
}

export async function pauseTimer(floorId: string, _eventId: string | null) {
  await timerCommand(await requireFloorAccess(floorId, ["producer"]), "pause");
}

export async function resumeTimer(floorId: string, _eventId: string | null) {
  await timerCommand(await requireFloorAccess(floorId, ["producer"]), "resume");
}

export async function resetTimer(floorId: string, _eventId: string | null) {
  await timerCommand(await requireFloorAccess(floorId, ["producer"]), "reset");
}

/** +/- adjustment (in seconds) applied to the timer while preserving running/paused state. */
export async function adjustTimer(floorId: string, deltaSeconds: number, _eventId: string | null) {
  const access = await requireFloorAccess(floorId, ["producer"]);
  await timerCommand(access, "adjust", { p_delta_seconds: parseArg(Delta, deltaSeconds) });
}
