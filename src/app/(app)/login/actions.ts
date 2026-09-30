"use server";

import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";

export async function signIn(_prevState: { error: string }, formData: FormData) {
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

  redirect("/admin");
}

export async function signOut() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}
