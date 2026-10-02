import { expectEmailSent } from "@/lib/auth/delivery";
import { auth } from "@/lib/auth/auth";

/**
 * Emails someone the link that lets them sign in: BetterAuth's password reset,
 * pointed at the page that fits them.
 *
 * Someone with a password already is resetting it, and lands on the page that
 * says so; everyone else is accepting an invitation. Throws if the email was not
 * sent (lib/auth/delivery.ts), because BetterAuth itself would swallow that.
 */
export async function sendPasswordLink(userId: string, email: string): Promise<void> {
  const ctx = await auth.$context;
  const accounts = await ctx.internalAdapter.findAccounts(userId);
  const redirectTo = accounts.some((a) => a.providerId === "credential")
    ? "/reset-password"
    : "/invite";

  await expectEmailSent(() => auth.api.requestPasswordReset({ body: { email, redirectTo } }));
}
