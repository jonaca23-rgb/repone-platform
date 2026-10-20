// Creates (or resets) one login per role on the LOCAL stack and prints them.
// Idempotent: re-running resets passwords and re-applies roles/assignments.
// Logins go through BetterAuth (createOrResetUser); everything the app keeps
// about them — profile, assignments, athlete link — through the service client;
// org roles through BetterAuth's addMember.
import { requireLocal } from "./env";

import { createClient } from "@supabase/supabase-js";
import { and, eq } from "drizzle-orm";
import { db as pg } from "@/db";
import { member } from "@/db/schema";
import { auth } from "@/lib/auth/auth";
import { DEV_PASSWORD as PASSWORD, createOrResetUser } from "./auth-helpers";

const ORG_ID = "00000000-0000-0000-0000-000000000001"; // from supabase/seed.sql
const LINKED_ATHLETE_ID = "00000000-0000-0000-0000-000000000061"; // Maria Rivera, seed.sql

type Kind = "admin" | "scorekeeper" | "producer" | "commentator" | "athlete" | "new-athlete";

const ACCOUNTS: { email: string; name: string; kind: Kind; note: string }[] = [
  {
    email: "admin@repone.test",
    name: "Ada Admin",
    kind: "admin",
    note: "/admin — org owner, every module",
  },
  {
    email: "scorekeeper@repone.test",
    name: "Sam Scorekeeper",
    kind: "scorekeeper",
    note: "/scorekeeper — assigned to every event",
  },
  {
    email: "producer@repone.test",
    name: "Pat Producer",
    kind: "producer",
    note: "/producer, /dashboard — assigned to every event",
  },
  {
    email: "commentator@repone.test",
    name: "Cruz Commentator",
    kind: "commentator",
    note: "/commentator — assigned to every event",
  },
  {
    email: "athlete@repone.test",
    name: "Maria Rivera",
    kind: "athlete",
    note: "/athlete — linked to seeded athlete Maria Rivera",
  },
  {
    email: "new-athlete@repone.test",
    name: "Nina Nueva",
    kind: "new-athlete",
    note: "/athlete — not onboarded yet (tests onboarding)",
  },
];

const ASSIGNMENT: Record<
  "scorekeeper" | "producer" | "commentator",
  { table: string; column: string }
> = {
  scorekeeper: { table: "event_scorekeeper_assignments", column: "scorekeeper_user_id" },
  producer: { table: "event_producer_assignments", column: "producer_user_id" },
  commentator: { table: "event_commentator_assignments", column: "commentator_user_id" },
};

// Supabase responses are `{ data, error: null } | { data: null, error }`;
// exit on the error branch and hand back the success branch's data.
type Response = { data: unknown; error: { message: string } | null };
function check<R extends Response>(
  label: string,
  res: R,
): NonNullable<Extract<R, { error: null }>["data"]> {
  if (res.error) {
    console.error(`${label}: ${res.error.message}`);
    process.exit(1);
  }
  return res.data as NonNullable<Extract<R, { error: null }>["data"]>;
}

async function main() {
  const target = requireLocal();
  const db = createClient(target.apiUrl, target.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const events = check(
    "list events",
    await db.from("events").select("id").eq("organization_id", ORG_ID),
  );
  let adminId: string | null = null;

  for (const account of ACCOUNTS) {
    const user = { id: await createOrResetUser(account.email, account.name, PASSWORD) };

    if (account.kind === "athlete" || account.kind === "new-athlete") {
      if (account.kind === "athlete") {
        check(
          "link athlete",
          await db.from("athletes").update({ auth_user_id: user.id }).eq("id", LINKED_ATHLETE_ID),
        );
      }
      continue;
    }

    // Staff: a display name on the profiles row (made by the trigger on public."user").
    check(
      "profile",
      await db.from("profiles").update({ full_name: account.name }).eq("id", user.id),
    );

    if (account.kind === "admin") {
      adminId = user.id;
      const [existing] = await pg
        .select({ id: member.id })
        .from(member)
        .where(and(eq(member.userId, user.id), eq(member.organizationId, ORG_ID)));
      if (!existing) {
        await auth.api.addMember({
          body: { userId: user.id, role: "owner", organizationId: ORG_ID },
        });
      }
      continue;
    }

    const { table, column } = ASSIGNMENT[account.kind];
    check(
      `${account.kind} assignments`,
      await db.from(table).upsert(
        events.map((e) => ({
          event_id: e.id,
          [column]: user.id,
          assigned_by_admin_id: adminId,
          status: "active",
        })),
        { onConflict: `event_id,${column}` },
      ),
    );
  }

  console.log(`\nLocal dev accounts (password for all: ${PASSWORD})\n`);
  for (const a of ACCOUNTS) console.log(`  ${a.email.padEnd(26)} ${a.note}`);
  console.log("");
  // BetterAuth's database pool would otherwise keep the process alive.
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
