// Signing in and creating accounts from scripts, through BetterAuth itself —
// the same rules, hashing and session cookies the app uses.
//
// Import this (or ./env) before anything that reads process.env at load time:
// ./env loads .env.local, and @/db builds its pool from DATABASE_URL on import.
import { requireLocal } from "./env";

import { type SupabaseClient, createClient } from "@supabase/supabase-js";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { account, user } from "@/db/schema";
import { auth } from "@/lib/auth/auth";
import type { Database } from "@/lib/db/database.types";
import { mintSupabaseToken } from "@/lib/supabase/sign-token";

/** Every local dev account's password (scripts/dev-accounts.ts). */
export const DEV_PASSWORD = "Repone1234!";

/** A Cookie header carrying every cookie a BetterAuth response set. */
export function cookieOf(response: Headers): string {
  return response
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

/**
 * Signs in for real, then returns a supabase-js client carrying the token the
 * app mints for that session — so a check exercises the production path:
 * signInEmail, getSession, mintSupabaseToken, then RLS. `headers` carries the
 * session cookie, for calls that act on the session (signOut, getSession).
 */
export async function signInAs(
  email: string,
  password: string = DEV_PASSWORD,
): Promise<{ db: SupabaseClient<Database>; userId: string; email: string; headers: Headers }> {
  const target = requireLocal();
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
  if (!publishable)
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY — run `pnpm env:local --force`.");

  const signedIn = await auth.api.signInEmail({ body: { email, password }, returnHeaders: true });
  const headers = new Headers({ cookie: cookieOf(signedIn.headers) });
  const current = await auth.api.getSession({ headers });
  if (!current) throw new Error(`${email}: no session after sign-in`);

  const token = await mintSupabaseToken({ userId: current.user.id, email: current.user.email });
  const client = createClient<Database>(target.apiUrl, publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
    accessToken: async () => token,
  });
  return { db: client, userId: current.user.id, email: current.user.email, headers };
}

/** Script and dev accounts sign in right away, so they skip the verification email. */
export async function markVerified(userId: string): Promise<void> {
  await db.update(user).set({ emailVerified: true }).where(eq(user.id, userId));
}

/**
 * Makes sure `email` can sign in with `password`, and returns the user's id.
 * A new person signs up (which creates their profiles row); an existing one has
 * their credential's password replaced with a fresh hash. Idempotent.
 */
export async function createOrResetUser(
  email: string,
  name: string,
  password: string,
): Promise<string> {
  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  if (!existing) {
    const created = await auth.api.signUpEmail({ body: { email, password, name } });
    await markVerified(created.user.id);
    return created.user.id;
  }
  await markVerified(existing.id);

  const hash = await (await auth.$context).password.hash(password);
  const updated = await db
    .update(account)
    .set({ password: hash })
    .where(and(eq(account.userId, existing.id), eq(account.providerId, "credential")))
    .returning({ id: account.id });
  if (updated.length === 0) {
    // A user without a password (e.g. Google only): give them one.
    await (await auth.$context).internalAdapter.createAccount({
      userId: existing.id,
      providerId: "credential",
      accountId: existing.id,
      password: hash,
    });
  }
  return existing.id;
}
