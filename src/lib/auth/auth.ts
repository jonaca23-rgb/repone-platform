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
import { APIError } from "better-auth/api";
import { admin as adminPlugin, organization } from "better-auth/plugins";
import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { reportDelivery } from "@/lib/auth/delivery";
import { existingAccountEmail, passwordLinkEmail, verifyEmail } from "@/lib/auth/emails";
import { ac, roles } from "@/lib/auth/permissions";
import { sendEmail } from "@/lib/mailer";

/** Google sign-in is offered only where its credentials are configured. */
export const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

const orgPlugin = organization({
  ac,
  roles,
  schema: { organization: { modelName: "organizations" } },
  // One organization, created by first-run setup (bootstrap_organization).
  allowUserToCreateOrganization: false,
  // The single org cascades to every event, athlete and result; nothing needs this route.
  disableOrganizationDeletion: true,
  organizationHooks: {
    // Invitations create the person instead (lib/auth/invite.ts, the Team
    // page). The plugin's flow would make them sign up and then accept, and
    // would grant roles outside the Team page's checks. Its route is closed
    // (disabledPaths); this refuses the server call too.
    beforeCreateInvitation: async () => {
      throw new APIError("FORBIDDEN", { message: "Invite people from the Team page." });
    },
  },
});

/**
 * Every organization-plugin HTTP route is closed (404). RepOne's browser code
 * calls none of them (lib/auth/client.ts has no organizationClient); the
 * server calls the plugin through auth.api, which disabledPaths does not touch.
 * Left open, list-members and get-full-organization would hand any member
 * every other member's email (only owners and admins may read those:
 * org_member_emails, 0030). Derived from the installed plugin, so a route an
 * upgrade adds starts closed too. Add a path to ORG_ROUTES_IN_USE to open it.
 */
const ORG_ROUTES_IN_USE: string[] = [];
const closedOrgRoutes = Object.values(orgPlugin.endpoints)
  .map((endpoint) => (endpoint as { path?: string }).path)
  .filter((path): path is string => !!path && !ORG_ROUTES_IN_USE.includes(path));

export const auth = betterAuth({
  disabledPaths: closedOrgRoutes,
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
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    // Sign-up waits for the verification link (autoSignInAfterVerification).
    autoSignIn: false,
    requireEmailVerification: true,
    // Invitations are password resets for people with no password yet:
    // resetPassword creates their credential. BetterAuth swallows errors thrown
    // here; reportDelivery hands the outcome to the inviting action
    // (lib/auth/delivery.ts).
    sendResetPassword: async ({ user, url }) => {
      const [org] = await db
        .select({ name: schema.organizations.name })
        .from(schema.member)
        .innerJoin(schema.organizations, eq(schema.organizations.id, schema.member.organizationId))
        .where(eq(schema.member.userId, user.id))
        .limit(1);
      await reportDelivery(() =>
        sendEmail(passwordLinkEmail({ to: user.email, url, organization: org?.name ?? null })),
      );
    },
    // Signing up with an address that already has an account. BetterAuth
    // answers exactly as for a new sign-up (requireEmailVerification), so the
    // page reveals nothing; the email tells the owner of the address what to
    // do. No password yet (invited) or never verified: their password link
    // (/invite or /reset-password). Otherwise: sign in or reset. A failure is
    // logged, never surfaced, so the answer stays the same.
    // The generic answer is a made-up user; give it the admin plugin's
    // defaults (role "user", not banned) so it matches a real new sign-up
    // field for field (db:auth-check compares them over HTTP).
    customSyntheticUser: ({ coreFields, additionalFields, id }) => ({
      ...coreFields,
      role: "user",
      banned: false,
      banReason: null,
      banExpires: null,
      ...additionalFields,
      id,
    }),
    onExistingUserSignUp: async ({ user }) => {
      try {
        const [credential] = await db
          .select({ id: schema.account.id })
          .from(schema.account)
          .where(
            and(eq(schema.account.userId, user.id), eq(schema.account.providerId, "credential")),
          )
          .limit(1);
        if (!credential || !user.emailVerified) {
          // Imported here: passwordLink.ts imports this module.
          const { sendPasswordLink } = await import("@/lib/auth/passwordLink");
          await sendPasswordLink(user.id, user.email);
        } else {
          const base = process.env.BETTER_AUTH_URL;
          await sendEmail(
            existingAccountEmail({
              to: user.email,
              loginUrl: `${base}/login`,
              forgotUrl: `${base}/forgot-password`,
            }),
          );
        }
      } catch (error) {
        console.error("sign-up: the existing-account email was not sent", error);
      }
    },
    resetPasswordTokenExpiresIn: 60 * 60 * 24 * 3, // invitations need days
    revokeSessionsOnPasswordReset: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    // A sign-in attempt while unverified sends a fresh link.
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    // The link's callbackURL defaults to "/" (email-verification.mjs), which is
    // where the verified person should land.
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail(verifyEmail({ to: user.email, url }));
    },
  },
  socialProviders: googleEnabled
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
      }
    : {},
  // Google links to an existing user only when that user's own email is
  // verified (BetterAuth's default requireLocalEmailVerified: true). Password
  // accounts now verify their email, so Google links to a verified password
  // account. Keep the default: linking to an unverified local account would let
  // someone pre-register a victim's email with a password and share the
  // account once the victim signs in with Google.
  account: { accountLinking: { enabled: true, trustedProviders: ["google"] } },
  user: {
    // Null until the first sign-in: the Team and event staff pages show the
    // invitation as pending (0030_invitations.sql). Never set by a client.
    additionalFields: { lastSignInAt: { type: "date", required: false, input: false } },
  },
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
        // Sessions are deleted at sign-out, so the sign-in is recorded on the
        // user: "pending" means it never happened.
        after: async (session) => {
          await db
            .update(schema.user)
            .set({ lastSignInAt: session.createdAt })
            .where(eq(schema.user.id, session.userId));
        },
      },
    },
  },
  plugins: [
    orgPlugin,
    // createUser for invitations (called server-side with no headers).
    adminPlugin(),
    nextCookies(), // must stay last: it sets cookies from the other plugins' responses
  ],
});
