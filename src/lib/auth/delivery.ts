import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Tells the admin who sent an invitation whether the email actually went out.
 *
 * BetterAuth calls emailAndPassword.sendResetPassword from inside its
 * request-password-reset endpoint and deliberately swallows anything it throws:
 * that endpoint is public, and its answer must not reveal whether an address
 * exists or whether mail to it works. Right for a stranger on the login page,
 * wrong for an admin inviting a colleague, who needs to know the invitation
 * never left.
 *
 * AsyncLocalStorage scopes a report to the one server action that asked for it.
 * The email callback records its outcome there; the action reads it back after
 * BetterAuth returns. Requests from the public endpoint run outside any scope,
 * so for them nothing changes.
 *
 * No server-only guard of its own: it is reached only through lib/auth/auth.ts,
 * whose app entry is guarded, and it needs node:async_hooks regardless.
 */
type Report = { outcome?: { sent: true } | { sent: false; error: unknown } };

const scope = new AsyncLocalStorage<Report>();

/**
 * Runs a BetterAuth call that should send an email, and throws if it did not.
 *
 * "Did not" includes never trying: BetterAuth skips the callback for an address
 * with no user, and would defer it entirely if advanced.backgroundTasks were
 * configured. Both surface here instead of as a false "sent".
 */
export async function expectEmailSent(request: () => Promise<unknown>): Promise<void> {
  const report: Report = {};
  await scope.run(report, request);

  if (!report.outcome) {
    throw new Error("The email was never attempted.");
  }
  if (!report.outcome.sent) {
    throw report.outcome.error;
  }
}

/** Wraps the actual send inside a BetterAuth email callback. */
export async function reportDelivery(send: () => Promise<void>): Promise<void> {
  const report = scope.getStore();
  try {
    await send();
    if (report) report.outcome = { sent: true };
  } catch (error) {
    if (report) report.outcome = { sent: false, error };
    throw error;
  }
}
