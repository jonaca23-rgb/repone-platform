import { redirect } from "next/navigation";
import { getAthleteSessionContext } from "@/lib/auth/session";
import { AthleteSignUpForm } from "./AthleteSignUpForm";

/**
 * Same recognized-session redirect as /athlete/login (see that page's
 * comment) — an already-signed-in athlete has no reason to see a sign-up
 * form, so landing here sends them straight to their dashboard (or
 * onboarding, if they signed up but never finished it).
 */
export default async function AthleteSignUpPage() {
  const ctx = await getAthleteSessionContext();
  if (ctx) redirect(ctx.athleteId ? "/athlete" : "/athlete/onboarding");

  return <AthleteSignUpForm />;
}
