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
  // Shared across serverless instances rather than per-instance memory.
  rateLimit: { storage: "database" },
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
