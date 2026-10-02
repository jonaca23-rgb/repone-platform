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
import { admin as adminPlugin, organization } from "better-auth/plugins";
import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { ac, roles } from "@/lib/auth/permissions";

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
      // Keyed by the model name the organization plugin is given below
      // (modelName: "organizations"); the adapter and its schema check look it up by that.
      organizations: schema.organizations,
      member: schema.member,
      invitation: schema.invitation,
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
  // Google links to an existing user only when that user's own email is
  // verified (BetterAuth's default requireLocalEmailVerified: true). Emails are
  // never verified here, so Google for an address that already has a password
  // account is refused with ?error=account_not_linked, which the athlete login
  // explains. Keep the default: linking to an unverified local account would let
  // someone pre-register a victim's email with a password and share the
  // account once the victim signs in with Google. Real linking needs email
  // verification first.
  account: { accountLinking: { enabled: true, trustedProviders: ["google"] } },
  databaseHooks: {
    session: {
      create: {
        // Every session opens in the person's organization (their first
        // membership), as the plugin's docs recommend; event-only staff and
        // athletes have none and open with null.
        before: async (session) => {
          const [first] = await db
            .select({ organizationId: schema.member.organizationId })
            .from(schema.member)
            .where(eq(schema.member.userId, session.userId))
            .orderBy(asc(schema.member.createdAt))
            .limit(1);
          return { data: { ...session, activeOrganizationId: first?.organizationId ?? null } };
        },
      },
    },
  },
  plugins: [
    organization({
      ac,
      roles,
      schema: { organization: { modelName: "organizations" } },
      // One organization, created by first-run setup (bootstrap_organization).
      allowUserToCreateOrganization: false,
      // The single org cascades to every event, athlete and result; nothing needs this route.
      disableOrganizationDeletion: true,
    }),
    // createUser for invitations (called server-side with no headers).
    adminPlugin(),
    nextCookies(), // must stay last: it sets cookies from the other plugins' responses
  ],
});
