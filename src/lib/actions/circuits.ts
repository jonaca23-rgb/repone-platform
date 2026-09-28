"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getSessionContext } from "@/lib/auth/session";

/**
 * Creates a standalone circuit (used from /admin/circuits directly — the
 * other way to start one is inline from the "New Event" form, which creates
 * the circuit and assigns the event to it in one step, see
 * createEvent in ./events.ts).
 */
export async function createCircuit(formData: FormData) {
  const ctx = await getSessionContext();
  if (!ctx?.organizationId) throw new Error("No organization on this account yet.");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Circuit name is required.");
  const description = String(formData.get("description") ?? "").trim() || null;
  const starts_on = String(formData.get("starts_on") ?? "") || null;
  const ends_on = String(formData.get("ends_on") ?? "") || null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("circuits")
    .insert({ organization_id: ctx.organizationId, name, description, starts_on, ends_on })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/admin/circuits");
  redirect(`/admin/circuits/${data.id}`);
}

/**
 * Deletes a circuit. `events.circuit_id` is `on delete set null`
 * (0008_circuits.sql), so every event that was part of this circuit simply
 * reverts to being a standalone event — nothing about those events'
 * divisions/heats/results/standings is touched.
 */
export async function deleteCircuit(circuitId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("circuits").delete().eq("id", circuitId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/circuits");
  redirect("/admin/circuits");
}

/** Adds an existing (currently standalone) event to a circuit. */
export async function addEventToCircuit(circuitId: string, formData: FormData) {
  const eventId = String(formData.get("event_id") ?? "");
  if (!eventId) throw new Error("Choose an event to add.");

  const supabase = await createClient();
  const { error } = await supabase.from("events").update({ circuit_id: circuitId }).eq("id", eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/circuits/${circuitId}`);
  revalidatePath("/admin");
}

/** Removes one event from a circuit — the event itself is untouched, it just goes back to standalone. */
export async function removeEventFromCircuit(circuitId: string, eventId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("events").update({ circuit_id: null }).eq("id", eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/circuits/${circuitId}`);
  revalidatePath("/admin");
}
