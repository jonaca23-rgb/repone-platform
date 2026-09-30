"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/db/server";
import { friendlyAthleteWriteError, nullIfBlank, requireEmail } from "@/lib/db/athleteErrors";
import { sqlNull } from "@/lib/db/sqlNull";

/**
 * Athlete accounts are a separate identity space from staff accounts (see
 * 0010_athlete_open_log.sql) — same Supabase Auth, but signup here never
 * touches `profiles.organization_id` or `user_roles`. It only creates the
 * auth.users row (via handle_new_user()'s trigger, that also gets a bare
 * profiles row automatically, same as staff) — the actual `athletes` link
 * happens one step later in completeAthleteOnboarding, once we know there's
 * a session to attach it to (see the comment there for why).
 */
export async function athleteSignUp(
  _prevState: { error: string; message?: string },
  formData: FormData,
) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email and password are required." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };

  // If the Supabase project requires email confirmation, signUp succeeds
  // but returns no session yet — nothing to redirect into. Handled here
  // instead of assuming one project setting or the other.
  if (!data.session) {
    return { error: "", message: "Check your email to confirm your account, then log in below." };
  }
  redirect("/athlete/onboarding");
}

export async function athleteSignIn(_prevState: { error: string }, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email and password are required." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  redirect("/athlete");
}

/**
 * "Continue with Google" for both sign-up and sign-in — Supabase treats a
 * first-time and a returning OAuth sign-in identically (it creates the
 * auth.users row the first time, just signs them in on every visit after),
 * so one action covers both the login and signup forms rather than needing
 * separate google-signup/google-signin variants.
 *
 * Runs as a Server Action (not a client-side supabase call) to stay
 * consistent with every other form on these two pages, which are all
 * zero-client-JS server actions. This still works for OAuth's redirect-based
 * flow: signInWithOAuth() here computes Google's consent-screen URL and
 * stashes the PKCE verifier in a cookie (a Server Action, unlike a plain
 * Server Component render, is allowed to set cookies — see lib/db/server.ts),
 * then this action redirects the browser there directly. Google redirects
 * back to /auth/callback, which reads that same cookie to finish the
 * exchange (see that route's own comment).
 *
 * If an athlete already has an email/password account, Supabase's Auth
 * automatically links the accounts as long as their email is verified —
 * confirmed with Jonathan this is the wanted behavior, not a hard error, so
 * an athlete can freely use either sign-in method going forward.
 */
export async function athleteSignInWithGoogle() {
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const protocol =
    hdrs.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${protocol}://${host}/auth/callback?next=/athlete` },
  });

  if (error || !data.url) redirect("/athlete/login?error=oauth");
  redirect(data.url);
}

export async function athleteSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/athlete/login");
}

/**
 * One-time step after first sign-in: links this auth account to a new
 * `athletes` row via the bootstrap_athlete() SECURITY DEFINER function
 * (0010_athlete_open_log.sql) — a normal insert can't do this, since
 * `athletes` writes are otherwise restricted to org staff. Deliberately not
 * done at signUp() time: with email confirmation enabled there's no session
 * yet at that point for `auth.uid()` to resolve to, so this waits until the
 * athlete actually has an authenticated session (first sign-in after
 * confirming, or immediately if confirmation is off).
 */
export async function completeAthleteOnboarding(formData: FormData) {
  const first_name = String(formData.get("first_name") ?? "").trim();
  const last_name = String(formData.get("last_name") ?? "").trim();
  if (!first_name || !last_name) throw new Error("First and last name are required.");
  const affiliate = nullIfBlank(formData.get("affiliate"));
  const date_of_birth = String(formData.get("date_of_birth") ?? "") || null;
  const genderRaw = String(formData.get("gender") ?? "");
  const gender = genderRaw === "male" || genderRaw === "female" ? genderRaw : null;
  const email = requireEmail(formData.get("email"));
  const phone = nullIfBlank(formData.get("phone"));

  const supabase = await createClient();
  const { error } = await supabase.rpc("bootstrap_athlete", {
    p_first_name: first_name,
    p_last_name: last_name,
    p_affiliate: sqlNull(affiliate),
    p_date_of_birth: sqlNull(date_of_birth),
    p_gender: sqlNull(gender),
    p_email: email,
    p_phone: phone ?? undefined,
  });
  if (error) throw new Error(friendlyAthleteWriteError(error));

  revalidatePath("/athlete");
  redirect("/athlete");
}
