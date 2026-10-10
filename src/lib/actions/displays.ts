"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { expectChanged, requireEventAccess } from "@/lib/auth/guards";
import { createClient } from "@/lib/db/server";
import type { InfoBlockType } from "@/lib/display/scheduler";
import { field, parseForm } from "@/lib/validation/form";
import { safeAction } from "./safeAction";

// Venue displays (0033): a screen that follows one of the event's floors.
// The event's producers and the org's managers run them.

const CreateForm = z.object({
  name: field.text("Display name", { max: 100 }),
  floor_id: field.id("Floor"),
});

const BLOCKS: Array<{ type: InfoBlockType; label: string }> = [
  { type: "current_heat", label: "Current heat" },
  { type: "next_heat", label: "Next heat" },
  { type: "leaderboard", label: "Leaderboard" },
];

const SettingsForm = z.object({
  sponsors_enabled: field.checkbox(),
  info_blocks_between_sponsors: field.int("Info blocks between sponsors", { min: 1, max: 5 }),
  ...Object.fromEntries(
    BLOCKS.flatMap(({ type, label }) => [
      [`${type}_enabled`, field.checkbox()],
      [`${type}_duration`, field.int(`${label} seconds`, { min: 5, max: 60 })],
      [`${type}_weight`, field.int(`${label} weight`, { min: 1, max: 10 })],
    ]),
  ),
});

const OTHER_FLOOR = "That floor isn't part of this event.";

const pathOf = (eventId: string) => `/producer/events/${eventId}/displays`;

export async function createDisplay(eventId: string, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    await requireEventAccess(eventId, ["producer"]);
    const f = parseForm(CreateForm, formData);
    const supabase = await createClient();
    const { error } = await supabase
      .from("display_devices")
      .insert({ event_id: eventId, floor_id: f.floor_id, name: f.name });
    if (error) {
      if (error.message.includes("display_floor_event")) {
        return fail(OTHER_FLOOR, { floor_id: [OTHER_FLOOR] });
      }
      throw new Error(error.message);
    }
    revalidatePath(pathOf(eventId));
    return ok();
  });
}

export async function toggleDisplayEnabled(
  eventId: string,
  displayId: string,
  enabled: boolean,
): Promise<ActionResult> {
  return safeAction(async () => {
    await requireEventAccess(eventId, ["producer"]);
    if (typeof enabled !== "boolean") return fail("Invalid display status.");
    const supabase = await createClient();
    expectChanged(
      await supabase
        .from("display_devices")
        .update({ enabled })
        .eq("id", displayId)
        .eq("event_id", eventId)
        .select("id"),
      "update the display",
    );
    revalidatePath(pathOf(eventId));
    return ok();
  });
}

export async function updateDisplaySettings(
  eventId: string,
  displayId: string,
  formData: FormData,
): Promise<ActionResult> {
  return safeAction(async () => {
    await requireEventAccess(eventId, ["producer"]);
    const f = parseForm(SettingsForm, formData) as Record<string, number | boolean>;
    const supabase = await createClient();
    expectChanged(
      await supabase
        .from("display_devices")
        .update({
          sponsors_enabled: f.sponsors_enabled as boolean,
          info_blocks_between_sponsors: f.info_blocks_between_sponsors as number,
        })
        .eq("id", displayId)
        .eq("event_id", eventId)
        .select("id"),
      "update the display",
    );
    const { error } = await supabase.from("display_blocks").upsert(
      BLOCKS.map(({ type }) => ({
        display_id: displayId,
        block_type: type,
        enabled: f[`${type}_enabled`] as boolean,
        duration_seconds: f[`${type}_duration`] as number,
        weight: f[`${type}_weight`] as number,
      })),
      { onConflict: "display_id,block_type" },
    );
    if (error) throw new Error(error.message);
    revalidatePath(pathOf(eventId));
    return ok();
  });
}
