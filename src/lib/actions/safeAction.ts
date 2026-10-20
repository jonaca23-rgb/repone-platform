import { APIError } from "better-auth/api";
import { type ActionFailure, type AnyActionResult, fail } from "@/lib/action-result";
import { NotAuthorizedError } from "@/lib/auth/guards";
import { InviteError } from "@/lib/auth/invite";
import { ValidationError } from "@/lib/validation/form";

const MUST_KEEP_OWNER = new Set([
  "YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER",
  "YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER",
]);

/** An expected failure, as a value; anything else (a bug, a redirect) is rethrown. */
export function toFailure(err: unknown): ActionFailure {
  if (err instanceof ValidationError) {
    return Object.keys(err.fieldErrors).length > 0
      ? fail(err.message, err.fieldErrors)
      : fail(err.message);
  }
  if (err instanceof NotAuthorizedError || err instanceof InviteError) return fail(err.message);
  if (err instanceof APIError) {
    const code = String(err.body?.code ?? "");
    if (MUST_KEEP_OWNER.has(code)) return fail("The organization must keep an owner.");
    return fail(err.body?.message ?? err.message);
  }
  throw err;
}

/**
 * The body of every migrated server action:
 *   export async function createX(fd: FormData): Promise<ActionResult> {
 *     return safeAction(async () => { …; return ok(); });
 *   }
 * Guards and parseForm keep throwing; this turns their errors into results.
 */
export async function safeAction<R extends AnyActionResult>(
  fn: () => Promise<R>,
): Promise<R | ActionFailure> {
  try {
    return await fn();
  } catch (err) {
    return toFailure(err);
  }
}
