// Proves BetterAuth owns sign-up, sign-in and sessions against the local stack,
// and that a signed-in person reaches Supabase with the app's own minted token.
//
//   pnpm db:auth-check     (needs the stack running, 0028 applied and `pnpm dev:accounts`)
import { requireLocal } from "./env";

import { createClient } from "@supabase/supabase-js";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { auth } from "@/lib/auth/auth";
import { splitRoles } from "@/lib/auth/permissions";
import { cookieOf, markVerified, signInAs } from "./auth-helpers";
import { clearMailbox, latestEmailTo } from "./mailpit";

const target = requireLocal();
const service = createClient(target.apiUrl, target.secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let failures = 0;
function expect(label: string, pass: boolean, detail?: unknown) {
  if (!pass) failures += 1;
  console.log(
    `${pass ? "ok  " : "FAIL"}  ${label}${pass || detail === undefined ? "" : `  -> ${JSON.stringify(detail)}`}`,
  );
}

/** The error code BetterAuth refused with, or null when the call succeeded. */
async function refusal(call: () => Promise<unknown>): Promise<string | null> {
  try {
    await call();
    return null;
  } catch (e) {
    if (e instanceof APIError) return String(e.body?.code ?? e.message);
    throw e;
  }
}

const email = `auth-check+${Date.now()}@example.test`;
const password = "correct-horse-battery";

async function main() {
  try {
    const signedUp = await auth.api.signUpEmail({
      body: { email, password, name: "Auth Check" },
    });
    const userId = signedUp.user.id;
    // Sign-up waits for the verification link; this check signs in right away.
    await markVerified(userId);
    const [row] = await db.select({ id: user.id }).from(user).where(eq(user.id, userId));
    expect('sign-up creates a public."user" row', row?.id === userId, row);

    const profile = await service
      .from("profiles")
      .select("id, full_name")
      .eq("id", userId)
      .maybeSingle();
    expect(
      "sign-up creates the profiles row with the same id and name",
      profile.data?.id === userId && profile.data?.full_name === "Auth Check",
      profile,
    );

    // Athlete sign-up sends name "" (the form asks only for email and password).
    const unnamed = await auth.api.signUpEmail({
      body: { email: `unnamed-${email}`, password, name: "" },
    });
    const unnamedProfile = await service
      .from("profiles")
      .select("full_name")
      .eq("id", unnamed.user.id)
      .maybeSingle();
    expect(
      'sign-up with name "" is accepted and stores full_name as null',
      !unnamedProfile.error &&
        unnamedProfile.data !== null &&
        unnamedProfile.data.full_name === null,
      unnamedProfile,
    );

    const wrong = await refusal(() =>
      auth.api.signInEmail({ body: { email, password: "not-the-password" } }),
    );
    expect(
      "wrong password is refused as INVALID_EMAIL_OR_PASSWORD",
      wrong === "INVALID_EMAIL_OR_PASSWORD",
      wrong,
    );

    const short = await refusal(() =>
      auth.api.signUpEmail({
        body: { email: `short-${email}`, password: "123456789", name: "Too Short" },
      }),
    );
    expect("a 9-character password is refused on sign-up", short === "PASSWORD_TOO_SHORT", short);

    const signedIn = await auth.api.signInEmail({
      body: { email, password },
      returnHeaders: true,
    });
    const headers = new Headers({ cookie: cookieOf(signedIn.headers) });
    const session = await auth.api.getSession({ headers });
    expect(
      "getSession with the sign-in cookie gives the same user",
      session?.user.id === userId,
      session?.user,
    );

    await auth.api.signOut({ headers });
    const after = await auth.api.getSession({ headers });
    expect("sign-out ends the session", after === null, after?.user);

    const admin = await signInAs("admin@repone.test");
    const roles = await admin.db
      .from("member")
      .select("user_id, role")
      .eq("user_id", admin.userId);
    expect(
      "signInAs(admin) reads the admin's own member row (owner) through RLS",
      !roles.error && roles.data?.some((r) => splitRoles(r.role).includes("owner")) === true,
      roles,
    );

    // The browser's token route (src/app/api/supabase-token) needs the app.
    const tokenRoute = await fetch("http://localhost:3200/api/supabase-token", {
      cache: "no-store",
    }).catch(() => null);
    if (tokenRoute) {
      expect(
        "/api/supabase-token without a session cookie answers 401",
        tokenRoute.status === 401,
        tokenRoute.status,
      );
    } else {
      console.warn("skip  /api/supabase-token 401 check: the app is not running on :3200");
    }

    // BetterAuth rate-limits only its HTTP routes, which is why the forms use
    // authClient. Its /sign-in rule allows 3 requests per 10 s per IP, so wrong
    // passwords posted back to back must meet a 429 within a few tries.
    if (tokenRoute) {
      const statuses: number[] = [];
      for (let i = 0; i < 6 && !statuses.includes(429); i++) {
        const res = await fetch("http://localhost:3200/api/auth/sign-in/email", {
          method: "POST",
          headers: { "content-type": "application/json", origin: "http://localhost:3200" },
          body: JSON.stringify({ email, password: `wrong-password-${i}` }),
        });
        statuses.push(res.status);
      }
      expect(
        "wrong passwords posted to /api/auth/sign-in/email meet a 429 within the window",
        statuses[0] === 401 && statuses.includes(429),
        statuses,
      );
    } else {
      console.warn("skip  sign-in rate limit check: the app is not running on :3200");
    }

    // The verification link points at the dev server (BETTER_AUTH_URL).
    if (tokenRoute) {
      console.log("\nEmail verification and reset (Mailpit)");
      await clearMailbox();
      const fresh = `verify+${Date.now()}@example.test`;
      await auth.api.signUpEmail({ body: { email: fresh, password: "Verify12345!", name: "" } });
      const verifyMail = await latestEmailTo(fresh);
      expect("sign-up sends a verification email", !!verifyMail?.links.length, verifyMail);
      const blocked = await auth.api.signInEmail({ body: { email: fresh, password: "Verify12345!" } }).catch((e) => e);
      expect("unverified sign-in is refused with EMAIL_NOT_VERIFIED", blocked?.body?.code === "EMAIL_NOT_VERIFIED", blocked?.body);
      const verifyRes = await fetch(verifyMail!.links[0], { redirect: "manual" });
      expect("the verification link redirects (verified)", verifyRes.status === 302 || verifyRes.status === 307, verifyRes.status);
      const ok = await auth.api.signInEmail({ body: { email: fresh, password: "Verify12345!" } }).catch((e) => e);
      expect("verified account signs in", !!ok?.user, ok?.body);

      // Signing up again with an address that already has an account: the
      // answer stays generic (no token, no error), and the email says so.
      await clearMailbox();
      const again = await auth.api
        .signUpEmail({ body: { email: fresh, password: "Another12345!", name: "" } })
        .catch((e: unknown) => e);
      expect(
        "sign-up with an existing verified email answers like a new sign-up",
        !(again instanceof Error) && (again as { token?: unknown }).token === null,
        again,
      );
      // Over HTTP the two answers must match field for field (the admin
      // plugin's role/banned fields included), or the page leaks the account.
      const signUpOverHttp = async (address: string) => {
        const res = await fetch("http://localhost:3200/api/auth/sign-up/email", {
          method: "POST",
          headers: { "content-type": "application/json", origin: "http://localhost:3200" },
          body: JSON.stringify({ email: address, password: "Another12345!", name: "" }),
        });
        const body = (await res.json()) as { token: unknown; user: Record<string, unknown> };
        const varies = ["id", "email", "createdAt", "updatedAt"];
        const fields = Object.entries(body.user ?? {}).filter(([k]) => !varies.includes(k)).sort();
        return JSON.stringify({ status: res.status, token: body.token, user: fields });
      };
      const newcomer = `newcomer+${Date.now()}@example.test`;
      const [existingAnswer, newAnswer] = [await signUpOverHttp(fresh), await signUpOverHttp(newcomer)];
      expect("over HTTP, sign-up answers an existing email exactly as a new one", existingAnswer === newAnswer, { existingAnswer, newAnswer });
      await service.from("user").delete().eq("email", newcomer);
      const already = await latestEmailTo(fresh);
      expect(
        "…and emails 'You already have a RepOne account' with /login and /forgot-password",
        !!already?.subject.includes("already have a RepOne account") &&
          already.links.some((l) => l.endsWith("/login")) &&
          already.links.some((l) => l.endsWith("/forgot-password")),
        already,
      );
      const stillOld = await auth.api.signInEmail({ body: { email: fresh, password: "Verify12345!" } }).catch((e) => e);
      expect("…and the existing password is unchanged", !!stillOld?.user, stillOld?.body);

      // An invited account (no password yet) signing up gets its invitation link.
      const invitedEmail = `invited-signup+${Date.now()}@example.test`;
      await auth.api.createUser({ body: { email: invitedEmail, name: "", data: { emailVerified: true } } });
      await clearMailbox();
      await auth.api.signUpEmail({ body: { email: invitedEmail, password: "Another12345!", name: "" } });
      const invitedMail = await latestEmailTo(invitedEmail);
      expect(
        "sign-up with an invited, passwordless email sends the /invite link",
        !!invitedMail?.links.some((l) => l.includes("callbackURL=%2Finvite")),
        invitedMail,
      );
      // Forgot-password (redirectTo /reset-password) for a passwordless
      // account reads as a reset, not an invitation.
      await auth.api.createUser({ body: { email: invitedEmail.replace("invited-signup", "invited-forgot"), name: "", data: { emailVerified: true } } });
      await clearMailbox();
      await auth.api.requestPasswordReset({ body: { email: invitedEmail.replace("invited-signup", "invited-forgot"), redirectTo: "/reset-password" } });
      const forgotMail = await latestEmailTo(invitedEmail.replace("invited-signup", "invited-forgot"));
      expect("forgot-password for a passwordless account uses the reset copy", !!forgotMail?.subject.includes("Reset your RepOne password"), forgotMail?.subject);
      await service.from("user").delete().in("email", [invitedEmail, invitedEmail.replace("invited-signup", "invited-forgot")]);

      await clearMailbox();
      await auth.api.requestPasswordReset({ body: { email: fresh, redirectTo: "/reset-password" } });
      const resetMail = await latestEmailTo(fresh);
      const token = resetMail?.links[0]?.match(/reset-password\/([^?]+)/)?.[1];
      expect("reset email carries a token", !!token, resetMail);
      await auth.api.resetPassword({ body: { token: token!, newPassword: "Changed12345!" } });
      const reuse = await auth.api.resetPassword({ body: { token: token!, newPassword: "Again12345!!" } }).catch((e) => e);
      expect("a reset link works once", !!reuse?.body || reuse instanceof Error, reuse);
      await service.from("user").delete().eq("email", fresh);
    } else {
      console.warn("skip  email verification checks: the app is not running on :3200");
    }
  } finally {
    // Cascades to session, account and profiles.
    const removed = await service.from("user").delete().like("email", `%${email}`);
    if (removed.error) console.error(`cleanup: ${removed.error.message}`);
  }

  console.log(failures ? `\n${failures} check(s) failed` : "\nAll auth checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
