"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { NotAuthorizedError, requireSignedIn } from "@/lib/auth/guards";
import { createClient } from "@/lib/db/server";
import { field, parseArg, parseForm } from "@/lib/validation/form";

const MessageForm = z.object({ body: field.text("Message", { max: 2000 }) });

/**
 * Sends a message from the signed-in user (athlete or staff) to
 * `recipientId`. Works identically from an athlete's thread page or a staff
 * member's admin thread page — both sides are just auth.users ids. RLS's
 * can_message() (0016_messaging.sql) is the real gate on who's allowed to
 * message whom; a refusal there surfaces as a clear error here.
 */
export async function sendMessage(recipientId: string, formData: FormData) {
  const ctx = await requireSignedIn();
  parseArg(field.id("Recipient"), recipientId);
  const { body } = parseForm(MessageForm, formData);

  const supabase = await createClient();
  const { error } = await supabase.from("messages").insert({
    sender_id: ctx.userId,
    recipient_id: recipientId,
    body,
  });
  if (error) {
    // 42501 = RLS refused the insert: can_message() said no.
    if (error.code === "42501") {
      throw new NotAuthorizedError("You can't message this person.");
    }
    throw new Error(error.message);
  }

  revalidatePath(`/athlete/messages/${recipientId}`);
  revalidatePath("/athlete/messages");
  revalidatePath(`/admin/messages/${recipientId}`);
  revalidatePath("/admin/messages");
}
