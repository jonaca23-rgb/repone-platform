"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getSessionContext } from "@/lib/auth/session";
import type { EventStatus } from "@/lib/db/database.types";

export async function createEvent(formData: FormData) {
  const ctx = await getSessionContext();
  if (!ctx?.organizationId) throw new Error("No organization on this account yet.");

  const name = String(formData.get("name") ?? "").trim();
  const starts_on = String(formData.get("starts_on") ?? "") || null;
  const ends_on = String(formData.get("ends_on") ?? "") || null;
  if (!name) throw new Error("Event name is required.");

  const supabase = await createClient();

  // Single Event vs. Circuit, decided right here at creation time:
  // "" = standalone (default), an existing circuit's id = join that circuit,
  // "new" = start a brand new circuit and put this event in it as its first stop.
  const circuitChoice = String(formData.get("circuit_choice") ?? "");
  let circuit_id: string | null = null;
  if (circuitChoice === "new") {
    const newCircuitName = String(formData.get("new_circuit_name") ?? "").trim();
    if (!newCircuitName) throw new Error("Circuit name is required when starting a new circuit.");
    const { data: circuit, error: circuitError } = await supabase
      .from("circuits")
      .insert({ organization_id: ctx.organizationId, name: newCircuitName })
      .select("id")
      .single();
    if (circuitError) throw new Error(circuitError.message);
    circuit_id = circuit.id;
  } else if (circuitChoice) {
    circuit_id = circuitChoice;
  }

  const { data, error } = await supabase
    .from("events")
    .insert({ organization_id: ctx.organizationId, name, starts_on, ends_on, circuit_id })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  // A fresh event needs at least one venue + floor before heats can be created
  // (floors are the unit heats/broadcast_state attach to). Create sensible
  // defaults so the operator isn't forced through extra setup screens first.
  const { data: venue } = await supabase
    .from("venues")
    .insert({ event_id: data.id, name: "Main Venue" })
    .select("id")
    .single();

  if (venue) {
    const { data: floor } = await supabase
      .from("floors")
      .insert({ venue_id: venue.id, name: "Floor A", sort_order: 0 })
      .select("id")
      .single();
    if (floor) {
      await supabase.from("broadcast_state").insert({ floor_id: floor.id });
    }
  }

  revalidatePath("/admin");
  if (circuit_id) revalidatePath(`/admin/circuits/${circuit_id}`);
  revalidatePath("/admin/circuits");
  redirect(`/admin/events/${data.id}`);
}

const MAX_COVER_PHOTO_BYTES = 8 * 1024 * 1024;

/**
 * Cover photo for the Events list card grid — mirrors
 * `uploadAthletePhoto`/`removeAthletePhoto` in lib/actions/athletes.ts
 * exactly (same 8MB cap, same public-bucket-plus-URL-column shape), just for
 * `events.cover_image_url` and the `event-photos` bucket
 * (0011_event_cover_photo.sql) instead of athlete photos.
 */
export async function uploadEventCoverPhoto(eventId: string, formData: FormData) {
  const file = formData.get("cover_photo");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose an image file to upload.");
  if (!file.type.startsWith("image/")) throw new Error("Please upload an image file.");
  if (file.size > MAX_COVER_PHOTO_BYTES) throw new Error("Image must be under 8MB.");

  const supabase = await createClient();
  const extMatch = /\.([a-zA-Z0-9]+)$/.exec(file.name);
  const ext = (extMatch?.[1] ?? "jpg").toLowerCase();
  const path = `${eventId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("event-photos")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicUrlData } = supabase.storage.from("event-photos").getPublicUrl(path);

  const { error } = await supabase
    .from("events")
    .update({ cover_image_url: publicUrlData.publicUrl })
    .eq("id", eventId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
  revalidatePath(`/admin/events/${eventId}`);
}

export async function removeEventCoverPhoto(eventId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("events").update({ cover_image_url: null }).eq("id", eventId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
  revalidatePath(`/admin/events/${eventId}`);
}

export async function updateEventStatus(eventId: string, status: EventStatus) {
  const supabase = await createClient();
  await supabase.from("events").update({ status }).eq("id", eventId);
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
  const supabase = await createClient();
  const { data: existing } = await supabase.from("events").select("circuit_id").eq("id", eventId).single();

  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
  if (existing?.circuit_id) revalidatePath(`/admin/circuits/${existing.circuit_id}`);
  redirect("/admin");
}
