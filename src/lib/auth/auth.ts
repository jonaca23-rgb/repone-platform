/**
 * The BetterAuth instance — one configuration for the app and the scripts.
 *
 * App code imports it from ./server, which adds the server-only guard. Scripts
 * import this module directly so they create accounts and sign people in by
 * exactly the app's rules.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { db } from "@/db";
import * as schema from "@/db/schema";

/** Google sign-in is offered only where its credentials are configured. */
export const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      rateLimit: schema.rateLimit,
    },
  }),
  // auth.uid() casts the minted token's sub to uuid, and every FK is a uuid.
  advanced: { database: { generateId: "uuid" } },
  // BetterAuth limits only requests through its HTTP routes (/api/auth/*), so
  // the sign-in and sign-up forms call those through authClient; a server-side
  // auth.api call is never limited. Its default is "production only"; it is on
  // everywhere here so db:auth-check can prove it against the dev server. The
  // built-in rule for /sign-in/* and /sign-up/* is 3 requests per 10 s per IP,
  // so a local lockout lasts at most 10 s. The rows live in the database,
  // shared across serverless instances rather than per-instance memory.
  rateLimit: { enabled: true, storage: "database" },
  emailAndPassword: { enabled: true, minPasswordLength: 10, autoSignIn: true },
  socialProviders: googleEnabled
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
      }
    : {},
  // A Google sign-in with a verified address joins the existing email/password user.
  account: { accountLinking: { enabled: true, trustedProviders: ["google"] } },
  plugins: [nextCookies()], // must stay last: it sets cookies from the other plugins' responses
});
