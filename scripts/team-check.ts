// Proves event teams on the LOCAL stack (0036_event_teams.sql): a team lives
// in one event and one of its team divisions, an athlete is on one team per
// event, a team never exceeds its division's size (even under concurrent
// adds), registrations match the division's format, and only the event's
// organizers write teams.
//
//   pnpm db:team-check     (needs pnpm dev:accounts and pnpm db:seed:qa)
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { signInAs } from "./auth-helpers";
import { requireLocal } from "./env";

const EVENT_ID = "00000000-0000-0000-0000-000000000010";
const INDIVIDUAL_DIVISION_ID = "00000000-0000-0000-0000-000000000040";
const A1 = "00000000-0000-0000-0000-000000000061";
const A2 = "00000000-0000-0000-0000-000000000062";
const A3 = "00000000-0000-0000-0000-000000000063";
const A4 = "00000000-0000-0000-0000-000000000064";

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
const refused = (r: { error: { message: string } | null }, tag: string) =>
  !!r.error?.message.includes(tag);

async function signIn(email: string): Promise<SupabaseClient> {
  try {
    return (await signInAs(email)).db as unknown as SupabaseClient;
  } catch (e) {
    console.error(
      `Cannot sign in as ${email} (${e instanceof Error ? e.message : e}). Run \`pnpm dev:accounts\`.`,
    );
    process.exit(1);
  }
}

async function main() {
  const admin = await signIn("admin@repone.test");
  const scorekeeper = await signIn("scorekeeper@repone.test");
  const anon = createClient(target.apiUrl, publishableKey, options);

  const pairs = await service
    .from("divisions")
    .insert({ event_id: EVENT_ID, name: "Check Pairs", entry_format: "pair", team_size: 2 })
    .select("id")
    .single();
  if (pairs.error) {
    expect("divisions carry a format and a team size", false, pairs.error.message);
    process.exit(1);
  }
  const PAIRS = pairs.data.id as string;
  const cleanup: Array<() => PromiseLike<unknown>> = [
    () => service.from("divisions").delete().eq("id", PAIRS),
  ];

  try {
    const badSize = await service
      .from("divisions")
      .insert({ event_id: EVENT_ID, name: "Check bad", entry_format: "team" });
    expect("a team division needs a team size", !!badSize.error, badSize.error);
    await service.from("divisions").delete().eq("event_id", EVENT_ID).eq("name", "Check bad");
    const badPair = await service
      .from("divisions")
      .insert({ event_id: EVENT_ID, name: "Check bad", entry_format: "pair", team_size: 3 });
    expect("a pairs division is two per team", !!badPair.error, badPair.error);
    await service.from("divisions").delete().eq("event_id", EVENT_ID).eq("name", "Check bad");

    const team = (name: string, division = PAIRS, event = EVENT_ID) =>
      ({ event_id: event, division_id: division, name }) as const;

    const t1 = await admin.from("teams").insert(team("Check One")).select("id").single();
    expect("a manager creates a team in a team division", !t1.error, t1.error);
    const t2 = await admin.from("teams").insert(team("Check Two")).select("id").single();
    const T1 = t1.data?.id as string;
    const T2 = t2.data?.id as string;

    expect(
      "a team name is unique in its event, whatever the case",
      !!(await admin.from("teams").insert(team(" check one "))).error,
    );
    expect(
      "a team can't be created in an individual division",
      refused(
        await admin.from("teams").insert(team("Check Ind", INDIVIDUAL_DIVISION_ID)),
        "team_division_individual",
      ),
    );
    const { data: otherDivision } = await service
      .from("divisions")
      .select("id")
      .neq("event_id", EVENT_ID)
      .limit(1)
      .maybeSingle();
    if (!otherDivision) expect("a division of another event exists (run pnpm db:seed:qa)", false);
    else {
      expect(
        "a team can't be created in another event's division",
        refused(
          await admin.from("teams").insert(team("Check Other", otherDivision.id)),
          "team_division_event",
        ),
      );
    }

    const member = (teamId: string, athleteId: string) => ({
      team_id: teamId,
      athlete_id: athleteId,
    });
    expect(
      "a manager adds a member",
      !(await admin.from("team_members").insert(member(T1, A1))).error,
    );
    expect(
      "an athlete on a team can't join another in the same event",
      refused(await admin.from("team_members").insert(member(T2, A1)), "team_member_other_team"),
    );

    // The last free spot, asked for twice at once: exactly one gets it.
    const race = await Promise.all([
      admin.from("team_members").insert(member(T1, A2)),
      admin.from("team_members").insert(member(T1, A3)),
    ]);
    expect(
      "two concurrent adds of the last spot: exactly one succeeds",
      race.filter((r) => !r.error).length === 1,
      race.map((r) => r.error?.message),
    );
    expect(
      "a full team refuses another member",
      refused(await admin.from("team_members").insert(member(T1, A4)), "team_full"),
    );

    const { data: org } = await service
      .from("organizations")
      .insert({ name: "Team check org", slug: `team-check-${Date.now()}` })
      .select("id")
      .single();
    cleanup.push(() =>
      service
        .from("organizations")
        .delete()
        .eq("id", org?.id ?? ""),
    );
    const { data: outsider } = await service
      .from("athletes")
      .insert({
        organization_id: org?.id,
        first_name: "Out",
        last_name: "Sider",
        email: "outsider@team-check.test",
      })
      .select("id")
      .single();
    expect(
      "an athlete of another organization can't join",
      refused(
        await admin.from("team_members").insert(member(T2, outsider?.id ?? "")),
        "team_member_org",
      ),
    );

    expect(
      "a non-member can't be captain",
      refused(
        await admin.from("teams").update({ captain_athlete_id: A4 }).eq("id", T1).select("id"),
        "team_captain_not_member",
      ),
    );
    await admin.from("teams").update({ captain_athlete_id: A1 }).eq("id", T1);
    await admin.from("team_members").delete().eq("team_id", T1).eq("athlete_id", A1);
    const captain = await service.from("teams").select("captain_athlete_id").eq("id", T1).single();
    expect(
      "removing the captain from the roster clears the captain",
      captain.data?.captain_athlete_id === null,
      captain.data,
    );

    expect(
      "an athlete can't register on their own in a team division",
      refused(
        await admin
          .from("registrations")
          .insert({ event_id: EVENT_ID, division_id: PAIRS, athlete_id: A4 }),
        "registration_kind",
      ),
    );
    expect(
      "a team can't register in an individual division",
      refused(
        await admin
          .from("registrations")
          .insert({ event_id: EVENT_ID, division_id: INDIVIDUAL_DIVISION_ID, team_id: T1 }),
        "registration_kind",
      ),
    );
    const mine = await service.from("registrations").select("id").eq("team_id", T1);
    expect(
      "creating a team registers it in its division, in the same step",
      (mine.data ?? []).length === 1,
      mine,
    );

    // The rules hold for edits too, not only for new rows.
    expect(
      "a member row can't be moved to another team",
      refused(
        await admin.from("team_members").update({ team_id: T2 }).eq("team_id", T1).select("id"),
        "team_member_fixed",
      ),
    );
    const threes = await service
      .from("divisions")
      .insert({ event_id: EVENT_ID, name: "Check Threes", entry_format: "team", team_size: 3 })
      .select("id")
      .single();
    cleanup.push(() =>
      service
        .from("divisions")
        .delete()
        .eq("id", threes.data?.id ?? ""),
    );
    expect(
      "a team can't be moved to another division",
      refused(
        await admin
          .from("teams")
          .update({ division_id: threes.data?.id })
          .eq("id", T1)
          .select("id"),
        "team_division_fixed",
      ),
    );
    expect(
      "a division with teams can't change its format",
      refused(
        await admin
          .from("divisions")
          .update({ entry_format: "individual", team_size: null })
          .eq("id", PAIRS)
          .select("id"),
        "division_format_locked",
      ),
    );
    expect(
      "a division with athletes registered can't become a team division",
      refused(
        await admin
          .from("divisions")
          .update({ entry_format: "team", team_size: 3 })
          .eq("id", INDIVIDUAL_DIVISION_ID)
          .select("id"),
        "division_format_locked",
      ),
    );
    const rename = await admin
      .from("divisions")
      .update({ name: "Check Pairs 2" })
      .eq("id", PAIRS)
      .select("id");
    expect(
      "a division with teams can still be renamed",
      (rename.data ?? []).length === 1,
      rename.error,
    );
    if (otherDivision) {
      const { data: otherEvent } = await service
        .from("divisions")
        .select("event_id")
        .eq("id", otherDivision.id)
        .single();
      expect(
        "a team can't register in another event",
        !!(
          await service
            .from("registrations")
            .insert({ event_id: otherEvent?.event_id, division_id: otherDivision.id, team_id: T1 })
        ).error,
      );
    }

    // A team member reads their team's registration and its payment (0037);
    // anyone else doesn't. athlete@ is linked to the seeded athlete …061.
    const athleteClient = await signIn("athlete@repone.test");
    const outsiderClient = await signIn("new-athlete@repone.test");
    const memberTeam = await admin
      .from("teams")
      .insert(team("Check Member Team"))
      .select("id")
      .single();
    const MT = memberTeam.data?.id as string;
    await admin.from("team_members").insert(member(MT, A1));
    const { data: memberRegistration } = await service
      .from("registrations")
      .select("id")
      .eq("team_id", MT)
      .single();
    await service
      .from("payments")
      .insert({ registration_id: memberRegistration?.id, amount_cents: 5000, status: "paid" });
    const ownRead = await athleteClient.from("registrations").select("id").eq("team_id", MT);
    expect(
      "a team member reads their team's registration",
      (ownRead.data ?? []).length === 1,
      ownRead,
    );
    const ownPayment = await athleteClient
      .from("payments")
      .select("id")
      .eq("registration_id", memberRegistration?.id ?? "");
    expect(
      "a team member reads their team's payment",
      (ownPayment.data ?? []).length === 1,
      ownPayment,
    );
    const otherRead = await outsiderClient.from("registrations").select("id").eq("team_id", MT);
    expect(
      "another athlete doesn't read that registration",
      (otherRead.data ?? []).length === 0,
      otherRead,
    );
    const otherPayment = await outsiderClient
      .from("payments")
      .select("id")
      .eq("registration_id", memberRegistration?.id ?? "");
    expect("another athlete doesn't read that payment", (otherPayment.data ?? []).length === 0);

    const anonRead = await anon.from("teams").select("id").eq("id", T1);
    expect(
      "anon reads teams (live page, overlays)",
      (anonRead.data ?? []).length === 1,
      anonRead.error,
    );
    expect(
      "anon can't create a team",
      !!(await anon.from("teams").insert(team("Check Anon"))).error,
    );
    expect(
      "anon can't add a member",
      !!(await anon.from("team_members").insert(member(T2, A4))).error,
    );
    expect(
      "a scorekeeper can't create a team",
      !!(await scorekeeper.from("teams").insert(team("Check SK"))).error,
    );
    expect(
      "a scorekeeper can't add a member",
      !!(await scorekeeper.from("team_members").insert(member(T2, A4))).error,
    );
  } finally {
    for (const undo of cleanup.reverse()) await undo();
  }
  if (failures) process.exit(1);
}
void main();
