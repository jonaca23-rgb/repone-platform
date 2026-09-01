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
  const { data, error } = await supabase
    .from("events")
    .insert({ organization_id: ctx.organizationId, name, starts_on, ends_on })
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
  redirect(`/admin/events/${data.id}`);
}

export async function updateEventStatus(eventId: string, status: EventStatus) {
  const supabase = await createClient();
  await supabase.from("events").update({ status }).eq("id", eventId);
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/admin");
}
