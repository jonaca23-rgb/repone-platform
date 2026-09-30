"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { expectChanged, requireOrgManager } from "@/lib/auth/guards";
import { createClient } from "@/lib/db/server";
import { field, parseForm } from "@/lib/validation/form";

const CircuitForm = z.object({
  name: field.text("Circuit name", { max: 200 }),
  description: field.optionalText({ label: "Description" }),
  starts_on: field.optionalDate("Start date"),
  ends_on: field.optionalDate("End date"),
});

const AddEventForm = z.object({
  event_id: z.guid({ error: "Choose an event to add." }),
});

/**
 * Creates a standalone circuit (used from /admin/circuits directly — the
 * other way to start one is inline from the "New Event" form, which creates
 * the circuit and assigns the event to it in one step, see
 * createEvent in ./events.ts).
 */
export async function createCircuit(formData: FormData) {
  const { organizationId } = await requireOrgManager();
  const f = parseForm(CircuitForm, formData);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("circuits")
    .insert({ organization_id: organizationId, ...f })
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
  const { organizationId } = await requireOrgManager();
  const supabase = await createClient();
  expectChanged(
    await supabase
      .from("circuits")
      .delete()
      .eq("id", circuitId)
      .eq("organization_id", organizationId)
      .select("id"),
    "delete the circuit",
  );

  revalidatePath("/admin/circuits");
  redirect("/admin/circuits");
}

/** Adds an existing (currently standalone) event to a circuit. */
export async function addEventToCircuit(circuitId: string, formData: FormData) {
  const { organizationId } = await requireOrgManager();
  const { event_id } = parseForm(AddEventForm, formData);

  const supabase = await createClient();
  const { data: circuit, error: circuitError } = await supabase
    .from("circuits")
    .select("id")
    .eq("id", circuitId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (circuitError) throw new Error(circuitError.message);
  if (!circuit) throw new Error("That circuit doesn't belong to your organization.");

  // Scoping the update by organization is the event's ownership check: an
  // event from another organization matches no rows and expectChanged throws.
  expectChanged(
    await supabase
      .from("events")
      .update({ circuit_id: circuit.id })
      .eq("id", event_id)
      .eq("organization_id", organizationId)
      .select("id"),
    "add the event to this circuit",
  );

  revalidatePath(`/admin/circuits/${circuitId}`);
  revalidatePath("/admin");
}

/** Removes one event from a circuit — the event itself is untouched, it just goes back to standalone. */
export async function removeEventFromCircuit(circuitId: string, eventId: string) {
  const { organizationId } = await requireOrgManager();
  const supabase = await createClient();
  expectChanged(
    await supabase
      .from("events")
      .update({ circuit_id: null })
      .eq("id", eventId)
      .eq("circuit_id", circuitId)
      .eq("organization_id", organizationId)
      .select("id"),
    "remove the event from this circuit",
  );

  revalidatePath(`/admin/circuits/${circuitId}`);
  revalidatePath("/admin");
}
