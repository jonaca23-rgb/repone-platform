import { redirect } from "next/navigation";
import { googleEnabled } from "@/lib/auth/server";
import { getAthleteSessionContext } from "@/lib/auth/session";
import { AthleteLoginForm } from "./AthleteLoginForm";

/**
 * A returning, already-recognized athlete (valid session cookie) never sees
 * this form: landing here directly (a bookmark, browser back button, etc.)
 * sends them straight to their dashboard, same as clicking "Athlete Portal"
 * from the home page. Only a genuinely signed-out visitor sees the form
 * below, and signing in redirects to /athlete (see athleteSignIn).
 */
export default async function AthleteLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const ctx = await getAthleteSessionContext();
  if (ctx) redirect(ctx.athleteId ? "/athlete" : "/athlete/onboarding");

  // A failed Google sign-in returns to errorCallbackURL (see GoogleButton)
  // with BetterAuth's code appended: ?error=oauth&error=<code>.
  const errors = [(await searchParams).error ?? []].flat();
  const oauthFailure = errors.includes("account_not_linked")
    ? "account_not_linked"
    : errors.includes("oauth")
      ? "other"
      : undefined;
  return <AthleteLoginForm oauthFailure={oauthFailure} googleEnabled={googleEnabled} />;
}
