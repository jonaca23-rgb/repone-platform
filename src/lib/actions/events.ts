"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { expectChanged, requireEventAccess, requireOrgManager } from "@/lib/auth/guards";
import { createClient } from "@/lib/db/server";
import type { EventStatus } from "@/lib/db/database.types";
import { Constants } from "@/lib/db/supabase.types";
import { field, imageUpload, parseForm } from "@/lib/validation/form";

const EventForm = z.object({
  name: field.text("Event name", { max: 200 }),
  starts_on: field.optionalDate("Start date"),
  ends_on: field.optionalDate("End date"),
  // "" = standalone, "new" = start a new circuit, otherwise an existing circuit's id.
  circuit_choice: z.union([z.literal("new"), field.optionalId("Circuit")]),
  new_circuit_name: field.optionalText({ max: 200, label: "Circuit name" }),
});

export async function createEvent(formData: FormData) {
  const { organizationId } = await requireOrgManager();
  const f = parseForm(EventForm, formData);

  const supabase = await createClient();

  // Single Event vs. Circuit, decided right here at creation time:
  // "" = standalone (default), an existing circuit's id = join that circuit,
  // "new" = start a brand new circuit and put this event in it as its first stop.
  let circuit_id: string | null = null;
  if (f.circuit_choice === "new") {
    if (!f.new_circuit_name) {
      throw new Error("Circuit name is required when starting a new circuit.");
    }
    const { data: circuit, error: circuitError } = await supabase
      .from("circuits")
      .insert({ organization_id: organizationId, name: f.new_circuit_name })
      .select("id")
      .single();
    if (circuitError) throw new Error(circuitError.message);
    circuit_id = circuit.id;
  } else if (f.circuit_choice) {
    const { data: circuit, error: circuitError } = await supabase
      .from("circuits")
      .select("id")
      .eq("id", f.circuit_choice)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (circuitError) throw new Error(circuitError.message);
    if (!circuit) throw new Error("That circuit doesn't belong to your organization.");
    circuit_id = circuit.id;
  }

  const { data, error } = await supabase
    .from("events")
    .insert({
      organization_id: organizationId,
      name: f.name,
      starts_on: f.starts_on,
      ends_on: f.ends_on,
      circuit_id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  // A fresh event needs at least one venue + floor before heats can be created
  // (floors are the unit heats/broadcast_state attach to). Create sensible
  // defaults so the operator isn't forced through extra setup screens first.
  const { data: venue, error: venueError } = await supabase
    .from("venues")
    .insert({ event_id: data.id, name: "Main Venue" })
    .select("id")
    .single();
  if (venueError)
    throw new Error(`Event created, but its default venue wasn't: ${venueError.message}`);

  const { data: floor, error: floorError } = await supabase
    .from("floors")
    .insert({ venue_id: venue.id, name: "Floor A", sort_order: 0 })
    .select("id")
    .single();
  if (floorError)
    throw new Error(`Event created, but its default floor wasn't: ${floorError.message}`);

  const { error: broadcastError } = await supabase
    .from("broadcast_state")
    .insert({ floor_id: floor.id });
  if (broadcastError) {
    throw new Error(
      `Event created, but its floor's broadcast state wasn't: ${broadcastError.message}`,
    );
  }

  revalidatePath("/admin");
  if (circuit_id) revalidatePath(`/admin/circuits/${circuit_id}`);
  revalidatePath("/admin/circuits");
  redirect(`/admin/events/${data.id}`);
}

/**
 * Cover photo for the Events list card grid — mirrors
 * `uploadAthletePhoto`/`removeAthletePhoto` in lib/actions/athletes.ts
 * exactly (same 8MB cap, same public-bucket-plus-URL-column shape), just for
 * `events.cover_image_url` and the `event-photos` bucket
 * (0011_event_cover_photo.sql) instead of athlete photos.
 */
export async function uploadEventCoverPhoto(eventId: string, formData: FormData) {
  const { organizationId } = await requireEventAccess(eventId);

  const { file, ext } = imageUpload(formData.get("cover_photo"));

  const supabase = await createClient();
  const path = `${eventId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("event-photos")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicUrlData } = supabase.storage.from("event-photos").getPublicUrl(path);

  expectChanged(
    await supabase
      .from("events")
      .update({ cover_image_url: publicUrlData.publicUrl })
      .eq("id", eventId)
      .eq("organization_id", organizationId)
      .select("id"),
    "save the cover photo",
  );

  revalidatePath("/admin");
  revalidatePath(`/admin/events/${eventId}`);
}

export async function removeEventCoverPhoto(eventId: string) {
  const { organizationId } = await requireEventAccess(eventId);
  const supabase = await createClient();
  expectChanged(
    await supabase
      .from("events")
      .update({ cover_image_url: null })
      .eq("id", eventId)
      .eq("organization_id", organizationId)
      .select("id"),
    "remove the cover photo",
  );

  revalidatePath("/admin");
  revalidatePath(`/admin/events/${eventId}`);
}

const EventStatusValue = field.oneOf(Constants.public.Enums.event_status, "event status");

export async function updateEventStatus(eventId: string, status: EventStatus) {
  const { organizationId } = await requireEventAccess(eventId);
  const parsed = EventStatusValue.safeParse(status);
  if (!parsed.success) throw new Error("Choose a valid event status.");

  const supabase = await createClient();
  expectChanged(
    await supabase
      .from("events")
      .update({ status: parsed.data })
      .eq("id", eventId)
      .eq("organization_id", organizationId)
      .select("id"),
    "change the event status",
  );
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/admin");
}

/**
 * Deletes an event outright. Every table that hangs off an event —
 * venues/floors, divisions, wods, heats/lanes, registrations, results,
 * standings, sponsors, fee_schedules (and payments/payment_line_items
 * through registrations), operator_actions — references events(id) with
 * `on delete cascade` (see 0001_init.sql / 0007_payments_and_teams.sql), so
 * one delete here removes the entire event's data. There is no undo.
 */
export async function deleteEvent(eventId: string) {
  const { organizationId } = await requireEventAccess(eventId);
  const supabase = await createClient();
  const [deleted] = expectChanged(
    await supabase
      .from("events")
      .delete()
      .eq("id", eventId)
      .eq("organization_id", organizationId)
      .select("id, circuit_id"),
    "delete the event",
  );

  revalidatePath("/admin");
  if (deleted.circuit_id) revalidatePath(`/admin/circuits/${deleted.circuit_id}`);
  redirect("/admin");
}
