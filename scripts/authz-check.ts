// Proves the app-layer authorization decisions (src/lib/auth/authorize.ts)
// on the LOCAL stack, as each dev account: who may manage the org, act on an
// event, drive a floor, or score a heat — including an event in ANOTHER
// organization, which no account here may touch. Server actions call these
// same functions through src/lib/auth/guards.ts.
//
//   pnpm db:authz-check     (needs pnpm dev:accounts to have run)
import { cookieOf, markVerified, signInAs } from "./auth-helpers";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/db/database.types";
import {
  assignedEvents,
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
    .insert({ name: "Authz other org", slug: `authz-other-${Date.now()}` })
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
      "admin session carries the org and owner role",
      admin.ctx?.organizationId === ORG_ID && admin.ctx.roles.includes("owner"),
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
      const signedUp = await auth.api.signUpEmail({
        body: { email: newEmail, password: "Repone1234!", name: newEmail },
      });
      newUserId = signedUp.user.id;
      // Sign-up waits for the verification link; verify, then sign in.
      await markVerified(newUserId);
      const created = await auth.api.signInEmail({
        body: { email: newEmail, password: "Repone1234!" },
        returnHeaders: true,
      });
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

    console.log("\nPermissions on member (0029)");
    {
      // Review Focus 2: an owner passes admin-only policies.
      const { error } = await admin.db
        .from("circuits")
        .insert({ organization_id: ORG_ID, name: "authz-owner-check" });
      expect(
        "owner passes an admin/event_director write (has_role admin includes owner)",
        !error,
        error,
      );
      await service.from("circuits").delete().eq("name", "authz-owner-check");

      // Review Focus 1: comma-joined roles are a union, in SQL and in the app.
      const { userId } = await signInAs("commentator@repone.test");
      const { error: insertError } = await service
        .from("member")
        .insert({ organization_id: ORG_ID, user_id: userId, role: "event_director,commentator" });
      expect("service role adds a two-role member row", !insertError, insertError);
      try {
        const twoRoles = await signInAs("commentator@repone.test");
        const twoCtx = await loadSessionContext(twoRoles.db, {
          userId: twoRoles.userId,
          email: twoRoles.email,
        });
        expect("two-role member manages the org (app)", orgManagerOf(twoCtx) === ORG_ID, twoCtx);
        const { error: e2 } = await twoRoles.db
          .from("circuits")
          .insert({ organization_id: ORG_ID, name: "authz-two-roles" });
        expect("two-role member passes event_director policies (SQL)", !e2, e2);
        await service.from("circuits").delete().eq("name", "authz-two-roles");

        // Read while still a member: "members read org members" is has_role-based.
        const { data: others } = await twoRoles.db.from("member").select("user_id");
        expect(
          "a member reads the org's other members",
          (others ?? []).some((m) => m.user_id !== userId),
          others,
        );
      } finally {
        await service.from("member").delete().eq("user_id", userId);
      }
    }

    console.log("\nAn org-wide staff role reaches every event in its org");
    {
      // A fresh account holding scoring_operator on member, with no assignment.
      const orgEmail = `authz-orgwide+${Date.now()}@example.test`;
      const signedUp = await auth.api.signUpEmail({
        body: { email: orgEmail, password: "Repone1234!", name: "Org-wide scorer" },
      });
      const orgUserId = signedUp.user.id;
      try {
        await markVerified(orgUserId);
        await service
          .from("member")
          .insert({ organization_id: ORG_ID, user_id: orgUserId, role: "scoring_operator" });
        const op = await as(orgEmail);
        expect(
          "org-wide scoring_operator passes eventAccess as scorekeeper",
          (await eventAccess(op.db, op.ctx, EVENT_ID, ["scorekeeper"])) !== null,
          op.ctx,
        );
        expect(
          "org-wide scoring_operator does NOT pass as producer",
          (await eventAccess(op.db, op.ctx, EVENT_ID, ["producer"])) === null,
        );
        expect(
          "org-wide scoring_operator may NOT act on another org's event",
          (await eventAccess(op.db, op.ctx, otherEvent!.id, ["scorekeeper"])) === null,
        );
        const listed = await assignedEvents(op.db, op.ctx, "scorekeeper");
        expect(
          "org-wide scoring_operator's scorekeeper picker lists the seed event",
          listed.some((e) => e.id === EVENT_ID),
          listed,
        );
        const notProducer = await assignedEvents(op.db, op.ctx, "producer");
        expect("…and its producer picker lists nothing", notProducer.length === 0, notProducer);
      } finally {
        await service.from("user").delete().eq("id", orgUserId);
      }
    }

    console.log("\nA producer reaches the screens that accept producers");
    {
      // Producers enter and correct scores (scorekeeper/[floorId]) and view
      // the commentator screens; their layouts must let them in (over HTTP).
      const probe = await fetch("http://localhost:3200/api/supabase-token", { cache: "no-store" }).catch(() => null);
      if (probe) {
        const p = await signInAs("producer@repone.test");
        const listed = await assignedEvents(p.db, await loadSessionContext(p.db, p), "scorekeeper");
        expect("producer's scorekeeper picker lists the seed event", listed.some((e) => e.id === EVENT_ID), listed);
        for (const path of [
          "/scorekeeper",
          `/scorekeeper/events/${EVENT_ID}`,
          `/scorekeeper/${FLOOR_ID}`,
          "/commentator",
          `/commentator/events/${EVENT_ID}/dashboard`,
        ]) {
          const res = await fetch(`http://localhost:3200${path}`, {
            headers: { cookie: p.headers.get("cookie") ?? "" },
            redirect: "manual",
          });
          expect(`producer GET ${path} answers 200`, res.status === 200, `${res.status} ${res.headers.get("location") ?? ""}`);
        }
      } else {
        console.log("skip  producer HTTP checks (dev server not running)");
      }
    }

    console.log("\nThe organization cannot be deleted (disableOrganizationDeletion)");
    {
      const owner = await signInAs("admin@repone.test");
      const body = { organizationId: ORG_ID };
      const inProcess = await auth.api
        .deleteOrganization({ headers: owner.headers, body })
        .then(() => null)
        .catch((e: unknown) => e);
      expect(
        "owner's deleteOrganization is refused (auth.api)",
        String((inProcess as { body?: { code?: string } } | null)?.body?.code) ===
          "ORGANIZATION_DELETION_DISABLED",
        inProcess,
      );
      // The same request over HTTP, as a browser would send it (needs `pnpm dev`).
      const http = await fetch("http://localhost:3200/api/auth/organization/delete", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3200",
          cookie: owner.headers.get("cookie") ?? "",
        },
        body: JSON.stringify(body),
      }).catch(() => null);
      if (http) {
        const text = await http.text();
        expect(
          "owner's POST /api/auth/organization/delete is refused",
          !http.ok && text.includes("ORGANIZATION_DELETION_DISABLED"),
          `${http.status} ${text}`,
        );
      } else {
        console.log("skip  POST /api/auth/organization/delete (dev server not running)");
      }
      const { data: org } = await service.from("organizations").select("id").eq("id", ORG_ID);
      expect("the organization still exists", org?.length === 1, org);
    }

    console.log("\nSigning out ends the identity");
    const beforeOut = await signInAs("admin@repone.test");
    const ownRoles = await beforeOut.db
      .from("member")
      .select("user_id")
      .eq("user_id", beforeOut.userId);
    expect(
      "signed in, admin reads their own member row",
      (ownRoles.data?.length ?? 0) > 0,
      ownRoles,
    );
    await auth.api.signOut({ headers: beforeOut.headers });
    const afterOut = await auth.api.getSession({ headers: beforeOut.headers });
    expect("after sign-out the session is gone", afterOut === null, afterOut);
    // With no session the app mints no token: the client is plain anon.
    const anonAfter = createClient<Database>(target.apiUrl, publishableKey, options);
    const rolesAfter = await anonAfter.from("member").select("user_id");
    expect(
      "after sign-out the client cannot read member",
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
