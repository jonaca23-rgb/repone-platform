"use server";

import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/server";

/**
 * Returns where to go rather than redirecting: the form follows it with a full
 * load, so no browser state from before the sign-in survives it (see
 * src/lib/auth/identityChange.ts).
 */
export async function signIn(
  _prevState: { error: string; redirectTo?: string },
  formData: FormData,
): Promise<{ error: string; redirectTo?: string }> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  // BetterAuth's nextCookies() plugin sets the session cookie on this response.
  try {
    await auth.api.signInEmail({ body: { email, password }, headers: await headers() });
  } catch (e) {
    if (isAPIError(e)) return { error: "Email or password is incorrect." };
    throw e;
  }

  return { error: "", redirectTo: "/admin" };
}

/** Ends the session; SignOutButton then leaves for /login with a full load. */
export async function signOut() {
  await auth.api.signOut({ headers: await headers() });
}
