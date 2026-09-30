// Proves the app-layer authorization decisions (src/lib/auth/authorize.ts)
// on the LOCAL stack, as each dev account: who may manage the org, act on an
// event, drive a floor, or score a heat — including an event in ANOTHER
// organization, which no account here may touch. Server actions call these
// same functions through src/lib/auth/guards.ts.
//
//   pnpm db:authz-check     (needs pnpm dev:accounts to have run)
import { cookieOf, signInAs } from "./auth-helpers";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/db/database.types";
import {
  eventAccess,
  heatScope,
  floorEventId,
  loadSessionContext,
  orgManagerOf,
} from "../src/lib/auth/authorize";
import { requireLocal } from "./env";
import { auth } from "../src/lib/auth/auth";
import { mintSupabaseToken } from "../src/lib/supabase/sign-token";

const EVENT_ID = "00000000-0000-0000-0000-000000000010";
const FLOOR_ID = "00000000-0000-0000-0000-000000000030";
const HEAT_ID = "00000000-0000-0000-0000-000000000070";
const ORG_ID = "00000000-0000-0000-0000-000000000001";

const target = requireLocal();
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient<Database>(target.apiUrl, target.secretKey, options);

let failures = 0;
function expect(label: string, pass: boolean, detail?: unknown) {
  if (!pass) failures += 1;
  console.log(
    `${pass ? "ok  " : "FAIL"}  ${label}${pass || detail === undefined ? "" : `  -> ${JSON.stringify(detail)}`}`,
  );
}

// Signs in through BetterAuth and asks with the token the app would mint, so
// the identity handed to loadSessionContext is the session's, as in the app.
async function as(email: string | null) {
  if (!email) {
    const db = createClient<Database>(target.apiUrl, publishableKey, options);
    return { db, ctx: await loadSessionContext(db, null) };
  }
  const signedIn = await signInAs(email).catch((e: unknown) => {
    console.error(`Cannot sign in as ${email}. Run \`pnpm dev:accounts\`.`, e);
    process.exit(1);
  });
  const identity = { userId: signedIn.userId, email: signedIn.email };
  return { db: signedIn.db, ctx: await loadSessionContext(signedIn.db, identity) };
}

async function main() {
  // An event in a second organization: nobody in the seed org may act on it.
  const { data: otherOrg } = await service
    .from("organizations")
    .insert({ name: "Authz other org" })
    .select("id")
    .single();
  const { data: otherEvent } = await service
    .from("events")
    .insert({ organization_id: otherOrg!.id, name: "Other org event", status: "live" })
    .select("id")
    .single();

  try {
    const admin = await as("admin@repone.test");
    const scorekeeper = await as("scorekeeper@repone.test");
    const producer = await as("producer@repone.test");
    const athlete = await as("athlete@repone.test");
    const anon = await as(null);

    console.log("\nSession context");
    expect("anonymous has no session", anon.ctx === null);
    expect(
      "admin session carries the org and admin role",
      admin.ctx?.organizationId === ORG_ID && admin.ctx.roles.includes("admin"),
      admin.ctx,
    );

    console.log("\nOrg management (events, divisions, roster, fees, sponsors…)");
    expect("admin manages the seed org", orgManagerOf(admin.ctx) === ORG_ID);
    for (const [who, s] of [
      ["scorekeeper", scorekeeper],
      ["producer", producer],
      ["athlete", athlete],
      ["anon", anon],
    ] as const) {
      expect(`${who} does not manage the org`, orgManagerOf(s.ctx) === null);
    }

    console.log("\nEvent access");
    expect(
      "admin may act on the seed event",
      (await eventAccess(admin.db, admin.ctx, EVENT_ID, [])) !== null,
    );
    expect(
      "admin may NOT act on another org's event",
      (await eventAccess(admin.db, admin.ctx, otherEvent!.id, [])) === null,
    );
    expect(
      "assigned scorekeeper may score the event",
      (await eventAccess(scorekeeper.db, scorekeeper.ctx, EVENT_ID, ["scorekeeper"])) !== null,
    );
    expect(
      "scorekeeper may NOT act as producer",
      (await eventAccess(scorekeeper.db, scorekeeper.ctx, EVENT_ID, ["producer"])) === null,
    );
    expect(
      "scorekeeper may NOT manage the event (no staff role allowed)",
      (await eventAccess(scorekeeper.db, scorekeeper.ctx, EVENT_ID, [])) === null,
    );
    expect(
      "producer may produce the event",
      (await eventAccess(producer.db, producer.ctx, EVENT_ID, ["producer"])) !== null,
    );
    expect(
      "athlete may not act on the event",
      (await eventAccess(athlete.db, athlete.ctx, EVENT_ID, [
        "scorekeeper",
        "producer",
        "commentator",
      ])) === null,
    );
    expect(
      "anonymous may not act on the event",
      (await eventAccess(anon.db, anon.ctx, EVENT_ID, ["scorekeeper"])) === null,
    );

    console.log("\nFloors and heats resolve their event on the server");
    expect(
      "seed floor belongs to the seed event",
      (await floorEventId(producer.db, FLOOR_ID)) === EVENT_ID,
    );
    expect(
      "unknown floor resolves to nothing",
      (await floorEventId(producer.db, "00000000-0000-0000-0000-00000000dead")) === null,
    );
    const heat = await heatScope(scorekeeper.db, HEAT_ID);
    expect(
      "seed heat resolves its event, WOD, division and floor",
      heat?.event_id === EVENT_ID &&
        heat.wod_id === "00000000-0000-0000-0000-000000000050" &&
        heat.division_id === "00000000-0000-0000-0000-000000000040" &&
        heat.floor_id === FLOOR_ID,
      heat,
    );

    console.log("\nA brand-new sign-up holds no staff power");
    const newEmail = `authz-new+${Date.now()}@example.test`;
    let newUserId: string | null = null;
    try {
      const created = await auth.api.signUpEmail({
        body: { email: newEmail, password: "Repone1234!", name: newEmail },
        returnHeaders: true,
      });
      newUserId = created.response.user.id;
      const session = await auth.api.getSession({
        headers: new Headers({ cookie: cookieOf(created.headers) }),
      });
      const token = await mintSupabaseToken({ userId: newUserId, email: newEmail });
      const db = createClient<Database>(target.apiUrl, publishableKey, {
        ...options,
        accessToken: async () => token,
      });
      const ctx = await loadSessionContext(db, { userId: newUserId, email: newEmail });
      expect("new sign-up has a session", session?.user.id === newUserId);
      expect("new sign-up does not manage any org", orgManagerOf(ctx) === null, ctx);
      expect(
        "new sign-up may not act on the seed event as any staff role",
        (await eventAccess(db, ctx, EVENT_ID, ["scorekeeper", "producer", "commentator"])) === null,
      );
    } finally {
      if (newUserId) {
        const removed = await service.from("user").delete().eq("id", newUserId);
        expect("new sign-up's user was cleaned up", !removed.error, removed.error);
      }
    }

    console.log("\nSigning out ends the identity");
    const beforeOut = await signInAs("admin@repone.test");
    const ownRoles = await beforeOut.db
      .from("user_roles")
      .select("user_id")
      .eq("user_id", beforeOut.userId);
    expect(
      "signed in, admin reads their own user_roles row",
      (ownRoles.data?.length ?? 0) > 0,
      ownRoles,
    );
    await auth.api.signOut({ headers: beforeOut.headers });
    const afterOut = await auth.api.getSession({ headers: beforeOut.headers });
    expect("after sign-out the session is gone", afterOut === null, afterOut);
    // With no session the app mints no token: the client is plain anon.
    const anonAfter = createClient<Database>(target.apiUrl, publishableKey, options);
    const rolesAfter = await anonAfter.from("user_roles").select("user_id");
    expect(
      "after sign-out the client cannot read user_roles",
      !!rolesAfter.error || (rolesAfter.data?.length ?? 0) === 0,
      rolesAfter,
    );
  } finally {
    await service.from("events").delete().eq("id", otherEvent!.id);
    await service.from("organizations").delete().eq("id", otherOrg!.id);
  }

  console.log(failures ? `\n${failures} check(s) FAILED\n` : "\nAll checks passed\n");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
