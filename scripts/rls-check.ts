// Proves the database's access rules against the LOCAL stack by signing in as
// each dev account (scripts/dev-accounts.ts) and as an anonymous visitor.
// Every audit finding closed by 0025_security_hardening.sql has a check here,
// alongside a "still allowed" check so a fix can't pass by breaking the app.
//
//   pnpm db:rls-check     (needs pnpm dev:accounts to have run)
//   RLS_ONLY=auth-tables pnpm db:rls-check   (just the auth-table section; needs no sign-in)
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireLocal } from "./env";

const PASSWORD = "Repone1234!";
const ORG_ID = "00000000-0000-0000-0000-000000000001";
const EVENT_ID = "00000000-0000-0000-0000-000000000010";
const OWN_ATHLETE_ID = "00000000-0000-0000-0000-000000000061"; // linked to athlete@
const OTHER_ATHLETE_ID = "00000000-0000-0000-0000-000000000062";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const target = requireLocal();
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
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
  const client = createClient(target.apiUrl, anonKey, options);
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.user) {
    console.error(
      `Cannot sign in as ${email} (${error?.message}). Run \`pnpm dev:accounts\` first.`,
    );
    process.exit(1);
  }
  return { client, userId: data.user.id };
}

// BetterAuth's tables must exist (service reads them) and be unreachable through the API.
async function authTablesArePrivate(anon: SupabaseClient) {
  console.log("\nAuth tables are private");
  for (const table of ["user", "session", "account", "verification", "rate_limit"]) {
    const exists = await service.from(table).select("*").limit(1);
    expect(`${table} table exists`, !exists.error, exists.error);
    const r = await anon.from(table).select("*").limit(1);
    expect(`anon cannot read ${table}`, !!r.error || (r.data?.length ?? 0) === 0, r.data);
  }
}

async function main() {
  const anon = createClient(target.apiUrl, anonKey, options);
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
        .insert({ name: "RLS check org" })
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

    await authTablesArePrivate(anon);
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
