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
import { cookieOf, signInAs } from "./auth-helpers";

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
      .from("user_roles")
      .select("user_id, role")
      .eq("user_id", admin.userId);
    expect(
      "signInAs(admin) reads the admin's own user_roles row through RLS",
      !roles.error && roles.data?.some((r) => r.role === "admin") === true,
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
