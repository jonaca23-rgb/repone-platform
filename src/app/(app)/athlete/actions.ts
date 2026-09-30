"use server";

import { isAPIError } from "better-auth/api";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/server";
import { createClient } from "@/lib/db/server";
import { z } from "zod";
import { requireSignedIn } from "@/lib/auth/guards";
import { friendlyAthleteWriteError } from "@/lib/db/athleteErrors";
import { sqlNull } from "@/lib/db/sqlNull";
import { Constants } from "@/lib/db/supabase.types";
import { field, parseForm } from "@/lib/validation/form";

const OnboardingForm = z.object({
  first_name: field.text("First name", { max: 100 }),
  last_name: field.text("Last name", { max: 100 }),
  affiliate: field.optionalText({ max: 200, label: "Affiliate" }),
  date_of_birth: field.optionalDate("Date of birth"),
  gender: z
    .preprocess(
      (v) => (v === "" ? undefined : v),
      field.oneOf(Constants.public.Enums.athlete_gender, "gender").optional(),
    )
    .transform((v) => v ?? null),
  email: field.email(),
  phone: field.phone(),
});

/**
 * Athlete accounts are a separate identity space from staff accounts (see
 * 0010_athlete_open_log.sql) — same BetterAuth user table, but signup here
 * never touches `profiles.organization_id` or `user_roles`. It only creates
 * the user (which also gets a bare profiles row, same as staff) — the actual
 * `athletes` link happens one step later in completeAthleteOnboarding.
 */
type AuthFormState = { error: string; redirectTo?: string };

// Sign-in and sign-up return where to go instead of redirecting: the form
// follows it with a full load, so no browser state from before survives it
// (see src/lib/auth/identityChange.ts).
export async function athleteSignUp(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email and password are required." };

  // autoSignIn is on, and nextCookies() sets the new session's cookie here.
  try {
    await auth.api.signUpEmail({
      body: { email, password, name: email },
      headers: await headers(),
    });
  } catch (e) {
    if (!isAPIError(e)) throw e;
    // Never echo BetterAuth's message for an existing email: it would reveal
    // which addresses have accounts.
    if (e.body?.code === "PASSWORD_TOO_SHORT") {
      return { error: "Password must be at least 10 characters." };
    }
    if (
      e.body?.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" ||
      e.body?.code === "USER_ALREADY_EXISTS"
    ) {
      return { error: "Couldn't create the account. If you already have one, sign in instead." };
    }
    return { error: "Couldn't create the account. Please try again." };
  }

  return { error: "", redirectTo: "/athlete/onboarding" };
}

export async function athleteSignIn(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email and password are required." };

  try {
    await auth.api.signInEmail({ body: { email, password }, headers: await headers() });
  } catch (e) {
    if (isAPIError(e)) return { error: "Email or password is incorrect." };
    throw e;
  }

  return { error: "", redirectTo: "/athlete" };
}

/** Ends the session; SignOutButton then leaves for /athlete/login with a full load. */
export async function athleteSignOut() {
  await auth.api.signOut({ headers: await headers() });
}

/**
 * One-time step after first sign-in: links this auth account to a new
 * `athletes` row via the bootstrap_athlete() SECURITY DEFINER function
 * (0010_athlete_open_log.sql) — a normal insert can't do this, since
 * `athletes` writes are otherwise restricted to org staff. Runs once the
 * athlete has a session, so `auth.uid()` resolves to them.
 */
export async function completeAthleteOnboarding(formData: FormData) {
  await requireSignedIn();
  const f = parseForm(OnboardingForm, formData);

  const supabase = await createClient();
  const { error } = await supabase.rpc("bootstrap_athlete", {
    p_first_name: f.first_name,
    p_last_name: f.last_name,
    p_affiliate: sqlNull(f.affiliate),
    p_date_of_birth: sqlNull(f.date_of_birth),
    p_gender: sqlNull(f.gender),
    p_email: f.email,
    p_phone: f.phone ?? undefined,
  });
  if (error) throw new Error(friendlyAthleteWriteError(error));

  revalidatePath("/athlete");
  redirect("/athlete");
}
