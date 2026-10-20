import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAthleteSessionContext } from "@/lib/auth/session";
import { OnboardingForm } from "./OnboardingForm";

export const metadata: Metadata = { title: "Your athlete profile" };

export default async function AthleteOnboardingPage() {
  const ctx = await getAthleteSessionContext();
  if (!ctx) redirect("/login");
  if (ctx.athleteId) redirect("/athlete");

  return <OnboardingForm defaultEmail={ctx.email ?? ""} />;
}
