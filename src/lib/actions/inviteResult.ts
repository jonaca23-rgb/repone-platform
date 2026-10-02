import { APIError } from "better-auth/api";
import { NotAuthorizedError } from "@/lib/auth/guards";
import { InviteError, resendInvitation, type InviteOutcome } from "@/lib/auth/invite";
import { ValidationError } from "@/lib/validation/form";

/**
 * What the Team and event staff forms show inline (useActionState). Shared by
 * lib/actions/team.ts and eventStaff.ts, which as "use server" modules may
 * only export async functions.
 */
export type FormResult = { ok: true; message: string } | { ok: false; message: string } | undefined;

/** The three outcomes of an invitation, in the inviter's words. */
export function inviteMessage(outcome: InviteOutcome): FormResult {
  if (!outcome.emailSent)
    return { ok: false, message: "Saved, but the email didn't send — use Resend." };
  return {
    ok: true,
    message: outcome.created ? "Invitation sent." : "Access granted and notified.",
  };
}

const MUST_KEEP_OWNER = new Set([
  "YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER",
  "YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER",
]);

/**
 * Errors a person can act on become an inline message; anything else is
 * rethrown to the error boundary rather than shown raw.
 */
export function failure(error: unknown): FormResult {
  if (error instanceof APIError) {
    const code = String(error.body?.code ?? "");
    if (MUST_KEEP_OWNER.has(code)) return { ok: false, message: "The organization must keep an owner." };
    return { ok: false, message: error.body?.message ?? error.message };
  }
  if (
    error instanceof ValidationError ||
    error instanceof NotAuthorizedError ||
    error instanceof InviteError
  )
    return { ok: false, message: error.message };
  throw error;
}

/** Sends a fresh invitation link; a delivery failure is the inviter's message, not a crash. */
export async function resendMessage(userId: string, email: string): Promise<FormResult> {
  try {
    await resendInvitation(userId, email);
    return { ok: true, message: "Invitation sent again." };
  } catch (error) {
    console.error("resend: the invitation email was not sent", error);
    return { ok: false, message: "The invitation email was not sent. Try again later." };
  }
}
