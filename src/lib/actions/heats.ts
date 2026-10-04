"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import {
  expectChanged,
  NotAuthorizedError,
  requireEventAccess,
  requireHeatAccess,
} from "@/lib/auth/guards";
import { createClient } from "@/lib/db/server";
import { recomputeOverallStandings } from "@/lib/scoring/recompute";
import { field, parseArg, parseForm } from "@/lib/validation/form";
import { safeAction } from "./safeAction";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Heats are managed by an org manager or a producer assigned to the event
// (0024_event_role_assignments.sql: "event producer manage heats/lanes").

const blankTo = (fallback: unknown) => (v: unknown) =>
  v === undefined || (typeof v === "string" && v.trim() === "") ? fallback : v;

const lanes = (label: string) => z.preprocess(blankTo("6"), field.int(label, { min: 1, max: 20 }));

/** <input type="datetime-local"> ("2026-09-29T10:30"); blank becomes null. */
const optionalLocalDateTime = (label: string) =>
  z
    .preprocess(
      blankTo(undefined),
      z.iso.datetime({ local: true, error: `${label} must be a valid date and time.` }).optional(),
    )
    .transform((v) => v ?? null);

const HeatRefs = {
  floor_id: field.id("Floor"),
  wod_id: field.id("WOD"),
  division_id: field.id("Division"),
  scheduled_start: optionalLocalDateTime("Scheduled start"),
};

const CreateHeatForm = z.object({
  ...HeatRefs,
  heat_number: field.int("Heat number", { min: 1, max: 1000 }),
  heat_count: z.preprocess(
    blankTo(undefined),
    field.int("Heat count", { min: 1, max: 1000 }).optional(),
  ),
  lane_count: lanes("Lane count"),
});

const GenerateHeatsForm = z.object({
  ...HeatRefs,
  lanes_per_heat: lanes("Lanes per heat"),
  interval_minutes: field.optionalNumber("Interval", { min: 0, max: 1440 }),
});

/** The floor, WOD and division a heat points at must all belong to this event. */
async function assertEventRefs(
  supabase: SupabaseServerClient,
  eventId: string,
  refs: { floor_id: string; wod_id: string; division_id: string },
) {
  const [floorRes, wodRes, divisionRes] = await Promise.all([
    supabase
      .from("floors")
      .select("id, venues!inner(event_id)")
      .eq("id", refs.floor_id)
      .eq("venues.event_id", eventId)
      .maybeSingle(),
    supabase.from("wods").select("id").eq("id", refs.wod_id).eq("event_id", eventId).maybeSingle(),
    supabase
      .from("divisions")
      .select("id")
      .eq("id", refs.division_id)
      .eq("event_id", eventId)
      .maybeSingle(),
  ]);
  for (const res of [floorRes, wodRes, divisionRes]) {
    if (res.error) throw new Error(res.error.message);
  }
  if (!floorRes.data) throw new NotAuthorizedError("That floor isn't part of this event.");
  if (!wodRes.data) throw new NotAuthorizedError("That WOD isn't part of this event.");
  if (!divisionRes.data) throw new NotAuthorizedError("That division isn't part of this event.");
}

export async function createHeat(eventId: string, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    await requireEventAccess(eventId, ["producer"]);
    const f = parseForm(CreateHeatForm, formData);

    const supabase = await createClient();
    await assertEventRefs(supabase, eventId, f);

    const { data: heat, error } = await supabase
      .from("heats")
      .insert({
        event_id: eventId,
        floor_id: f.floor_id,
        wod_id: f.wod_id,
        division_id: f.division_id,
        heat_number: f.heat_number,
        heat_count: f.heat_count ?? null,
        scheduled_start: f.scheduled_start,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const laneRows = Array.from({ length: f.lane_count }, (_, i) => ({
      heat_id: heat.id,
      lane_number: i + 1,
    }));
    const { error: laneErr } = await supabase.from("lanes").insert(laneRows);
    if (laneErr) {
      // Don't leave a heat with no lanes behind.
      await supabase.from("heats").delete().eq("id", heat.id).eq("event_id", eventId);
      return fail(`Couldn't add the heat's lanes: ${laneErr.message}`);
    }

    revalidatePath(`/admin/events/${eventId}/heats`);
    return ok();
  });
}

export async function deleteHeat(eventId: string, heatId: string): Promise<ActionResult> {
  return safeAction(async () => {
    await requireEventAccess(eventId, ["producer"]);
    parseArg(field.id("Heat"), heatId);

    const supabase = await createClient();
    expectChanged(
      await supabase.from("heats").delete().eq("id", heatId).eq("event_id", eventId).select("id"),
      "remove the heat",
    );
    revalidatePath(`/admin/events/${eventId}/heats`);
    return ok();
  });
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
 *
 * The event and floor come from the heat itself; the eventId/floorId
 * arguments the page binds are ignored.
 */
export async function finishHeat(_eventId: string, heatId: string, _floorId: string | null) {
  const { eventId, heat } = await requireHeatAccess(heatId, ["scorekeeper", "producer"]);
  const supabase = await createClient();
  expectChanged(
    await supabase
      .from("heats")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", heat.id)
      .eq("event_id", eventId)
      .select("id"),
    "finish the heat",
  );

  // The last heat finishing completes the WOD for this division, which is
  // when competitors with no result start counting as last overall.
  await recomputeOverallStandings(heat.division_id, supabase);

  revalidatePath(`/admin/events/${eventId}/heats`);
  revalidatePath(`/overlay`);
  if (heat.floor_id) revalidatePath(`/scorekeeper/${heat.floor_id}`);
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
export async function generateHeats(eventId: string, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    await requireEventAccess(eventId, ["producer"]);

    // Remember the lane count as soon as it's read (before the rest of the
    // form is checked) — once the operator has set up e.g. "8 lanes" for this
    // event's floor, every later WOD/division they generate heats for should
    // default to the same count instead of resetting to 6, whether or not this
    // particular generate call succeeds.
    const lanesOnly = z
      .object({ lanes_per_heat: GenerateHeatsForm.shape.lanes_per_heat })
      .safeParse({ lanes_per_heat: formData.get("lanes_per_heat") ?? undefined });
    if (lanesOnly.success) {
      const cookieStore = await cookies();
      cookieStore.set(`repone_lanes_per_heat_${eventId}`, String(lanesOnly.data.lanes_per_heat), {
        maxAge: 60 * 60 * 24 * 180,
        sameSite: "lax",
      });
    }

    const f = parseForm(GenerateHeatsForm, formData);
    const interval_minutes = f.interval_minutes ?? 0;

    const supabase = await createClient();
    await assertEventRefs(supabase, eventId, f);

    const { data: existingHeats, error: existingErr } = await supabase
      .from("heats")
      .select("id")
      .eq("event_id", eventId)
      .eq("wod_id", f.wod_id)
      .eq("division_id", f.division_id);
    if (existingErr) throw new Error(existingErr.message);
    if ((existingHeats ?? []).length > 0) {
      return fail(
        "Heats already exist for this WOD/Division — remove them first (or use Add Single Heat) before generating a new set, so no one ends up double-booked.",
      );
    }

    const { data: registrations, error: regErr } = await supabase
      .from("registrations")
      .select("athlete_id, team_id")
      .eq("event_id", eventId)
      .eq("division_id", f.division_id)
      .order("created_at");
    if (regErr) throw new Error(regErr.message);

    const participants = (registrations ?? []).filter((r) => r.athlete_id || r.team_id);
    if (participants.length === 0) {
      return fail(
        "No registered athletes/teams found for this division — register participants first.",
      );
    }

    const heatCount = Math.ceil(participants.length / f.lanes_per_heat);
    const baseStart = f.scheduled_start ? new Date(f.scheduled_start) : null;

    for (let i = 0; i < heatCount; i++) {
      const heatScheduledStart = baseStart
        ? new Date(baseStart.getTime() + i * interval_minutes * 60_000).toISOString()
        : null;

      const { data: heat, error: heatErr } = await supabase
        .from("heats")
        .insert({
          event_id: eventId,
          floor_id: f.floor_id,
          wod_id: f.wod_id,
          division_id: f.division_id,
          heat_number: i + 1,
          heat_count: heatCount,
          scheduled_start: heatScheduledStart,
        })
        .select("id")
        .single();
      if (heatErr) throw new Error(heatErr.message);

      const heatParticipants = participants.slice(i * f.lanes_per_heat, (i + 1) * f.lanes_per_heat);
      const laneRows = Array.from({ length: f.lanes_per_heat }, (_, laneIdx) => ({
        heat_id: heat.id,
        lane_number: laneIdx + 1,
        athlete_id: heatParticipants[laneIdx]?.athlete_id ?? null,
        team_id: heatParticipants[laneIdx]?.team_id ?? null,
      }));
      const { error: laneErr } = await supabase.from("lanes").insert(laneRows);
      if (laneErr) throw new Error(laneErr.message);
    }

    revalidatePath(`/admin/events/${eventId}/heats`);
    return ok();
  });
}
