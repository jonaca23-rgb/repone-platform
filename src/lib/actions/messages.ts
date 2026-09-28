"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";

/**
 * Sends a message from the signed-in user (athlete or staff) to
 * `recipientId`. Works identically from an athlete's thread page or a staff
 * member's admin thread page — both sides are just auth.users ids. RLS's
 * can_message() (0016_messaging.sql) is the real gate on who's allowed to
 * message whom; this only validates the body isn't empty and resolves who
 * "me" (the sender) is.
 */
export async function sendMessage(recipientId: string, formData: FormData) {
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { error } = await supabase.from("messages").insert({
    sender_id: user.id,
    recipient_id: recipientId,
    body,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/athlete/messages/${recipientId}`);
  revalidatePath("/athlete/messages");
  revalidatePath(`/admin/messages/${recipientId}`);
  revalidatePath("/admin/messages");
}
