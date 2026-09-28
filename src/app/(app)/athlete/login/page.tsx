import { redirect } from "next/navigation";
import { getAthleteSessionContext } from "@/lib/auth/session";
import { AthleteLoginForm } from "./AthleteLoginForm";

/**
 * A returning, already-recognized athlete (valid session cookie — see
 * src/proxy.ts, which refreshes it on every /athlete/* request) never sees
 * this form: landing here directly (a bookmark, browser back button, etc.)
 * sends them straight to their dashboard, same as clicking "Athlete Portal"
 * from the home page. Only a genuinely signed-out visitor sees the form
 * below, and signing in redirects to /athlete (see athleteSignIn).
 */
export default async function AthleteLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const ctx = await getAthleteSessionContext();
  if (ctx) redirect(ctx.athleteId ? "/athlete" : "/athlete/onboarding");

  const { error } = await searchParams;
  return <AthleteLoginForm oauthError={error === "oauth"} />;
}
