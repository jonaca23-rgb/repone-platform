// Proves the database's access rules against the LOCAL stack by signing in as
// each dev account (scripts/dev-accounts.ts) and as an anonymous visitor.
// Every audit finding closed by 0025_security_hardening.sql has a check here,
// alongside a "still allowed" check so a fix can't pass by breaking the app.
//
//   pnpm db:rls-check     (needs pnpm dev:accounts to have run)
//   RLS_ONLY=auth-tables pnpm db:rls-check   (just the auth-table section, as anon; needs no sign-in)
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createOrResetUser, DEV_PASSWORD, signInAs } from "./auth-helpers";
import { requireLocal } from "./env";

const ORG_ID = "00000000-0000-0000-0000-000000000001";
const EVENT_ID = "00000000-0000-0000-0000-000000000010";
const OWN_ATHLETE_ID = "00000000-0000-0000-0000-000000000061"; // linked to athlete@
const OTHER_ATHLETE_ID = "00000000-0000-0000-0000-000000000062";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const target = requireLocal();
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(target.apiUrl, target.secretKey, options);

let failures = 0;
function expect(label: string, pass: boolean, detail?: unknown) {
  if (!pass) failures += 1;
  console.log(
    `${pass ? "ok  " : "FAIL"}  ${label}${pass || detail === undefined ? "" : `  -> ${JSON.stringify(detail)}`}`,
  );
}

async function signIn(email: string): Promise<{ client: SupabaseClient; userId: string }> {
  try {
    const { db, userId } = await signInAs(email);
    return { client: db as unknown as SupabaseClient, userId };
  } catch (e) {
    console.error(
      `Cannot sign in as ${email} (${e instanceof Error ? e.message : e}). Run \`pnpm dev:accounts\` first.`,
    );
    process.exit(1);
  }
}

// BetterAuth's tables must exist (service reads them) and be unreachable through
// the API, signed out and signed in: `account` holds password hashes, `session`
// live session tokens. The signed-in probe uses the org admin, the account with
// the most access.
async function authTablesArePrivate(
  anon: SupabaseClient,
  signedIn?: { label: string; client: SupabaseClient },
) {
  console.log("\nAuth tables are private");
  for (const table of ["user", "session", "account", "verification", "rate_limit"]) {
    const exists = await service.from(table).select("*").limit(1);
    expect(`${table} table exists`, !exists.error, exists.error);
    const r = await anon.from(table).select("*").limit(1);
    expect(`anon cannot read ${table}`, !!r.error || (r.data?.length ?? 0) === 0, r.data);
    if (signedIn) {
      const s = await signedIn.client.from(table).select("*").limit(1);
      expect(
        `${signedIn.label} cannot read ${table}`,
        !!s.error || (s.data?.length ?? 0) === 0,
        s.data,
      );
    }
  }
}

// An org-wide working role (member.role, granted from the Members page) must
// reach every event in its organization exactly as far as the matching event
// assignment reaches one event (0031_org_roles_match_assignments.sql), and no
// further: not other roles' tables, not another organization's events.
const SEED_HEAT_ID = "00000000-0000-0000-0000-000000000070";
const SEED_WOD_ID = "00000000-0000-0000-0000-000000000050";
const SEED_DIVISION_ID = "00000000-0000-0000-0000-000000000040";
const SPARE_ATHLETE_ID = "00000000-0000-0000-0000-000000000066"; // seeded, no result in the seed heat
const FLOOR_ID = "00000000-0000-0000-0000-000000000030";

async function orgWideStaffMatchTheirPermissions(cleanup: Array<() => PromiseLike<unknown>>) {
  console.log("\nOrg-wide staff roles reach what their event assignment reaches");
  const roles = ["production_director", "scoring_operator", "commentator"] as const;
  const people = {} as Record<(typeof roles)[number], { client: SupabaseClient; userId: string }>;
  for (const role of roles) {
    const email = `rls-org-${role.replaceAll("_", "-")}@repone.test`;
    const userId = await createOrResetUser(email, `RLS ${role}`, DEV_PASSWORD);
    await service.from("member").delete().eq("user_id", userId);
    const { error } = await service
      .from("member")
      .insert({ organization_id: ORG_ID, user_id: userId, role });
    expect(`service grants org-wide ${role}`, !error, error);
    cleanup.push(() => service.from("user").delete().eq("id", userId));
    people[role] = await signIn(email);
  }

  const canInsertLane = async (c: SupabaseClient) => {
    const r = await c.from("lanes").insert({ heat_id: SEED_HEAT_ID, lane_number: 97 }).select("id");
    await service.from("lanes").delete().eq("heat_id", SEED_HEAT_ID).eq("lane_number", 97);
    return !r.error && (r.data?.length ?? 0) === 1;
  };
  const canInsertResult = async (c: SupabaseClient) => {
    const r = await c
      .from("results")
      .insert({ heat_id: SEED_HEAT_ID, wod_id: SEED_WOD_ID, athlete_id: SPARE_ATHLETE_ID, reps: 1 })
      .select("id");
    await service
      .from("results")
      .delete()
      .eq("heat_id", SEED_HEAT_ID)
      .eq("athlete_id", SPARE_ATHLETE_ID);
    return !r.error && (r.data?.length ?? 0) === 1;
  };
  const canInsertStanding = async (c: SupabaseClient) => {
    const r = await c
      .from("standings")
      .insert({
        event_id: EVENT_ID,
        division_id: SEED_DIVISION_ID,
        wod_id: SEED_WOD_ID,
        athlete_id: SPARE_ATHLETE_ID,
        placement: 1,
      })
      .select("id");
    await service
      .from("standings")
      .delete()
      .eq("wod_id", SEED_WOD_ID)
      .eq("athlete_id", SPARE_ATHLETE_ID);
    return !r.error && (r.data?.length ?? 0) === 1;
  };
  const canUpdateHeat = async (c: SupabaseClient) => {
    const { data: heat, error } = await service
      .from("heats")
      .select("heat_count")
      .eq("id", SEED_HEAT_ID)
      .single();
    if (error || !heat) throw new Error(`seed heat unreadable: ${error?.message}`);
    const r = await c
      .from("heats")
      .update({ heat_count: heat.heat_count })
      .eq("id", SEED_HEAT_ID)
      .select("id");
    return !r.error && (r.data?.length ?? 0) === 1;
  };
  const canUpdateBroadcast = async (c: SupabaseClient) => {
    const r = await c
      .from("broadcast_state")
      .update({ active_graphic: "none" })
      .eq("floor_id", FLOOR_ID)
      .select("id");
    return !r.error && (r.data?.length ?? 0) === 1;
  };
  const canReadRegistrations = async (c: SupabaseClient, eventId = EVENT_ID) => {
    const r = await c.from("registrations").select("id").eq("event_id", eventId);
    return !r.error && (r.data?.length ?? 0) > 0;
  };

  const pd = people.production_director.client;
  const so = people.scoring_operator.client;
  const cm = people.commentator.client;

  // production_director ≈ event producer: heats, lanes, results, standings, broadcast, read field.
  expect("org production director manages heats", await canUpdateHeat(pd));
  expect("org production director manages lanes", await canInsertLane(pd));
  expect("org production director enters results", await canInsertResult(pd));
  expect("org production director writes standings", await canInsertStanding(pd));
  expect("org production director drives broadcast_state", await canUpdateBroadcast(pd));
  expect("org production director reads the event's registrations", await canReadRegistrations(pd));

  // scoring_operator ≈ event scorekeeper: heats, lanes, results, standings, read field; no broadcast.
  expect("org scoring operator manages heats", await canUpdateHeat(so));
  expect("org scoring operator manages lanes", await canInsertLane(so));
  expect("org scoring operator enters results", await canInsertResult(so));
  expect("org scoring operator writes standings", await canInsertStanding(so));
  expect("org scoring operator cannot drive broadcast_state", !(await canUpdateBroadcast(so)));
  expect("org scoring operator reads the event's registrations", await canReadRegistrations(so));

  // commentator ≈ event commentator: reads the field, writes nothing.
  expect("org commentator reads the event's registrations", await canReadRegistrations(cm));
  expect("org commentator cannot manage heats", !(await canUpdateHeat(cm)));
  expect("org commentator cannot manage lanes", !(await canInsertLane(cm)));
  expect("org commentator cannot enter results", !(await canInsertResult(cm)));
  expect("org commentator cannot write standings", !(await canInsertStanding(cm)));
  expect("org commentator cannot drive broadcast_state", !(await canUpdateBroadcast(cm)));

  // None of the working roles manage the event itself or its registrations.
  // The athlete is new, so only RLS (42501) can refuse the registration.
  const { data: unregistered, error: unregisteredError } = await service
    .from("athletes")
    .insert({
      organization_id: ORG_ID,
      first_name: "Unregistered",
      last_name: "Athlete",
      email: `rls-unregistered-${Date.now()}@example.test`,
    })
    .select("id")
    .single();
  expect("service creates an unregistered athlete", !unregisteredError, unregisteredError);
  if (unregistered) cleanup.push(() => service.from("athletes").delete().eq("id", unregistered.id));
  for (const role of roles) {
    const c = people[role].client;
    const reg = await c
      .from("registrations")
      .insert({ event_id: EVENT_ID, division_id: SEED_DIVISION_ID, athlete_id: unregistered?.id })
      .select("id");
    if (reg.data?.length) await service.from("registrations").delete().eq("id", reg.data[0].id);
    expect(
      `org ${role} cannot add registrations`,
      reg.error?.code === "42501",
      reg.error ?? reg.data,
    );
    const wod = await c.from("wods").update({ name: "WOD 2" }).eq("id", SEED_WOD_ID).select("id");
    expect(`org ${role} cannot edit WODs`, !!wod.error || (wod.data?.length ?? 0) === 0, wod.data);
  }

  // Another organization's event stays out of reach.
  const { data: otherOrg, error: orgError } = await service
    .from("organizations")
    .insert({ name: "RLS other org", slug: `rls-other-${Date.now()}` })
    .select("id")
    .single();
  expect("service creates another organization", !orgError, orgError);
  if (!otherOrg) return;
  cleanup.push(() => service.from("organizations").delete().eq("id", otherOrg.id));
  const { data: otherEvent, error: eventError } = await service
    .from("events")
    .insert({ organization_id: otherOrg.id, name: "RLS other event" })
    .select("id")
    .single();
  expect("service creates the other organization's event", !eventError, eventError);
  if (!otherEvent) return;
  const { data: otherDivision, error: divisionError } = await service
    .from("divisions")
    .insert({ event_id: otherEvent.id, name: "Other division" })
    .select("id")
    .single();
  expect("service creates the other event's division", !divisionError, divisionError);
  const { data: otherAthlete, error: athleteError } = await service
    .from("athletes")
    .insert({
      organization_id: otherOrg.id,
      first_name: "Other",
      last_name: "Org",
      email: `rls-other-${Date.now()}@example.test`,
    })
    .select("id")
    .single();
  expect("service creates the other organization's athlete", !athleteError, athleteError);
  const { error: otherRegError } = await service.from("registrations").insert({
    event_id: otherEvent.id,
    division_id: otherDivision?.id,
    athlete_id: otherAthlete?.id,
  });
  expect("service registers the other athlete", !otherRegError, otherRegError);
  expect(
    "service sees the other organization's registration",
    await canReadRegistrations(service, otherEvent.id),
  );
  for (const role of roles) {
    expect(
      `org ${role} cannot read another organization's registrations`,
      !(await canReadRegistrations(people[role].client, otherEvent.id)),
    );
  }
}

async function main() {
  const anon = createClient(target.apiUrl, publishableKey, options);
  if (process.env.RLS_ONLY === "auth-tables") {
    await authTablesArePrivate(anon);
    process.exit(failures ? 1 : 0);
  }
  const admin = await signIn("admin@repone.test");
  const athlete = await signIn("athlete@repone.test");
  const newAthlete = await signIn("new-athlete@repone.test");
  const producer = await signIn("producer@repone.test");
  const commentator = await signIn("commentator@repone.test");
  const cleanup: Array<() => PromiseLike<unknown>> = [];

  try {
    console.log("\nC1 athlete personal data");
    for (const column of ["email", "phone", "date_of_birth", "auth_user_id"]) {
      const r = await anon.from("athletes").select(column).limit(1);
      expect(`anon cannot read athletes.${column}`, !!r.error, r.data);
    }
    {
      const r = await anon
        .from("athletes")
        .select("id, first_name, last_name, affiliate, photo_url")
        .limit(1);
      expect(
        "anon still reads broadcast-safe athlete columns",
        !r.error && (r.data?.length ?? 0) > 0,
        r.error,
      );
    }
    for (const column of ["email", "phone", "date_of_birth"]) {
      const r = await athlete.client.from("athletes").select(column).limit(1);
      expect(`signed-in athlete cannot read athletes.${column}`, !!r.error, r.data);
    }
    {
      const r = await athlete.client.rpc("athlete_private_details", {
        p_athlete_ids: [OWN_ATHLETE_ID, OTHER_ATHLETE_ID],
      });
      const ids = (r.data ?? []).map((d: { id: string }) => d.id);
      expect(
        "athlete gets only their own private details",
        !r.error && ids.length === 1 && ids[0] === OWN_ATHLETE_ID,
        r.error ?? ids,
      );
    }
    {
      const r = await admin.client.rpc("athlete_private_details", {
        p_athlete_ids: [OTHER_ATHLETE_ID],
      });
      expect(
        "admin reads any org athlete's private details",
        !r.error && r.data?.[0]?.email,
        r.error ?? r.data,
      );
    }
    {
      const r = await commentator.client.rpc("athlete_private_details", {
        p_athlete_ids: [OTHER_ATHLETE_ID],
      });
      expect(
        "event-assigned commentator reads private details",
        !r.error && r.data?.length === 1,
        r.error ?? r.data,
      );
    }
    {
      const r = await anon.rpc("athlete_private_details", { p_athlete_ids: [OTHER_ATHLETE_ID] });
      expect(
        "anon cannot call athlete_private_details",
        !!r.error || (r.data?.length ?? 0) === 0,
        r.data,
      );
    }

    console.log("\nH1 organization bootstrap");
    for (const [who, c] of [
      ["new athlete", newAthlete.client],
      ["athlete", athlete.client],
      ["anon", anon],
    ] as const) {
      const r = await c.rpc("bootstrap_organization", { p_name: "Hijack Org" });
      expect(`${who} cannot create an organization`, !!r.error, r.data);
    }
    {
      const { count } = await service
        .from("organizations")
        .select("id", { count: "exact", head: true });
      expect("still exactly one organization", count === 1, count);
    }

    console.log("\nH3 storage");
    const upload = (c: SupabaseClient, bucket: string, path: string, type = "image/png") =>
      c.storage.from(bucket).upload(path, PNG, { contentType: type, upsert: true });
    const track = (bucket: string, path: string) =>
      cleanup.push(() => service.storage.from(bucket).remove([path]));
    {
      const path = `${OTHER_ATHLETE_ID}/rls-check.png`;
      const r = await upload(athlete.client, "athlete-photos", path);
      track("athlete-photos", path);
      expect("athlete cannot write another athlete's photo", !!r.error, r.data);
    }
    {
      const path = `${OWN_ATHLETE_ID}/rls-check.png`;
      const r = await upload(athlete.client, "athlete-photos", path);
      track("athlete-photos", path);
      expect("athlete can write their own photo", !r.error, r.error);
    }
    {
      const path = `${OTHER_ATHLETE_ID}/rls-check-admin.png`;
      const r = await upload(admin.client, "athlete-photos", path);
      track("athlete-photos", path);
      expect("admin can write any org athlete's photo", !r.error, r.error);
    }
    {
      const path = `${EVENT_ID}/rls-check.png`;
      const r = await upload(athlete.client, "event-photos", path);
      track("event-photos", path);
      expect("athlete cannot write event photos", !!r.error, r.data);
    }
    {
      const path = `${EVENT_ID}/rls-check-producer.png`;
      const r = await upload(producer.client, "event-photos", path);
      track("event-photos", path);
      expect("assigned producer can write their event's photo", !r.error, r.error);
    }
    {
      const path = `${OTHER_ATHLETE_ID}/rls-check.txt`;
      const r = await upload(admin.client, "athlete-photos", path, "text/plain");
      track("athlete-photos", path);
      expect("bucket rejects non-image uploads", !!r.error, r.data);
    }

    console.log("\nM4 policy holes");
    {
      const r = await athlete.client
        .from("athletes")
        .insert({
          organization_id: ORG_ID,
          first_name: "Hijack",
          last_name: "Link",
          email: "hijack@example.test",
          auth_user_id: newAthlete.userId,
        })
        .select("id");
      if (r.data?.[0]) cleanup.push(() => service.from("athletes").delete().eq("id", r.data[0].id));
      expect("athlete cannot link a roster athlete to someone else's account", !!r.error, r.data);
    }
    {
      const r = await athlete.client
        .from("athletes")
        .insert({
          organization_id: ORG_ID,
          first_name: "Roster",
          last_name: "Add",
          email: "roster.add@example.test",
        })
        .select("id");
      if (r.data?.[0]) cleanup.push(() => service.from("athletes").delete().eq("id", r.data[0].id));
      expect("athlete can still add an unlinked roster athlete", !r.error, r.error);
    }
    {
      const { data: otherOrg } = await service
        .from("organizations")
        .insert({ name: "RLS check org", slug: `rls-check-${Date.now()}` })
        .select("id")
        .single();
      cleanup.push(() =>
        service
          .from("organizations")
          .delete()
          .eq("id", otherOrg?.id ?? ""),
      );
      // If the move ever succeeds, put the event back BEFORE the org is
      // deleted (events cascade-delete with their organization).
      cleanup.push(() =>
        service.from("events").update({ organization_id: ORG_ID }).eq("id", EVENT_ID),
      );
      const r = await producer.client
        .from("events")
        .update({ organization_id: otherOrg?.id })
        .eq("id", EVENT_ID)
        .select("id");
      expect("producer cannot move their event to another organization", !!r.error, r.data);
      const ok = await producer.client
        .from("events")
        .update({ name: "Aprieta Entry Level" })
        .eq("id", EVENT_ID)
        .select("id");
      expect(
        "producer can still edit their event's details",
        !ok.error && ok.data?.length === 1,
        ok.error ?? ok.data,
      );
    }
    {
      const { data: msg } = await service
        .from("messages")
        .insert({ sender_id: admin.userId, recipient_id: athlete.userId, body: "original" })
        .select("id")
        .single();
      cleanup.push(() =>
        service
          .from("messages")
          .delete()
          .eq("id", msg?.id ?? ""),
      );
      const r = await athlete.client
        .from("messages")
        .update({ body: "forged" })
        .eq("id", msg?.id ?? "")
        .select("id");
      expect(
        "recipient cannot rewrite a message",
        !!r.error || (r.data?.length ?? 0) === 0,
        r.data,
      );
      const ok = await athlete.client
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("id", msg?.id ?? "");
      expect("recipient can still mark a message read", !ok.error, ok.error);
    }
    {
      const r = await producer.client
        .from("operator_actions")
        .insert({ event_id: EVENT_ID, user_id: admin.userId, action: "rls-check" });
      expect("operator log cannot be written as another user", !!r.error, r);
      const ok = await producer.client
        .from("operator_actions")
        .insert({ event_id: EVENT_ID, user_id: producer.userId, action: "rls-check" });
      cleanup.push(() => service.from("operator_actions").delete().eq("action", "rls-check"));
      expect("operator log can be written as yourself", !ok.error, ok.error);
    }

    console.log("\nEvent staff see their event's field");
    {
      const scorekeeper = await signIn("scorekeeper@repone.test");
      const r = await scorekeeper.client
        .from("registrations")
        .select("id")
        .eq("event_id", EVENT_ID);
      expect(
        "assigned scorekeeper reads the event's registrations (standings need the full field)",
        !r.error && (r.data?.length ?? 0) > 0,
        r.error ?? r.data,
      );
      const other = await newAthlete.client
        .from("registrations")
        .select("id")
        .eq("event_id", EVENT_ID);
      expect(
        "unassigned user cannot read the event's registrations",
        (other.data?.length ?? 0) === 0,
        other.data,
      );
    }

    await orgWideStaffMatchTheirPermissions(cleanup);

    await authTablesArePrivate(anon, { label: "signed-in admin", client: admin.client });
  } finally {
    for (const undo of cleanup.reverse()) await undo();
  }

  console.log(failures ? `\n${failures} check(s) FAILED\n` : "\nAll checks passed\n");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
