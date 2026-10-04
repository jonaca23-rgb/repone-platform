import type { ActionResult } from "@/lib/action-result";
import { resendInvitation, type InviteOutcome } from "@/lib/auth/invite";
import { toFailure } from "./safeAction";

/**
 * What the Team and event staff forms show inline (useActionState). Shared by
 * lib/actions/team.ts and eventStaff.ts, which as "use server" modules may
 * only export async functions.
 */
export type FormResult = ActionResult | undefined;

/** The three outcomes of an invitation, in the inviter's words. */
export function inviteMessage(outcome: InviteOutcome): ActionResult {
  if (!outcome.emailSent)
    return { ok: false, message: "Saved, but the email didn't send — use Resend." };
  return {
    ok: true,
    message: outcome.created ? "Invitation sent." : "Access granted and notified.",
  };
}

/** An expected failure as a FormResult; see safeAction's toFailure. */
export function failure(error: unknown): FormResult {
  return toFailure(error);
}

/** Sends a fresh invitation link; a delivery failure is the inviter's message, not a crash. */
export async function resendMessage(userId: string, email: string): Promise<ActionResult> {
  try {
    await resendInvitation(userId, email);
    return { ok: true, message: "Invitation sent again." };
  } catch (error) {
    console.error("resend: the invitation email was not sent", error);
    return { ok: false, message: "The invitation email was not sent. Try again later." };
  }
}
