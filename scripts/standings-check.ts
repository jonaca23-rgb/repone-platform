// Proves standings rewrites are atomic on the LOCAL stack: concurrent
// replace_standings() calls (two scorekeepers saving at once) never leave a
// division's leaderboard duplicated or empty, and the table itself refuses a
// second overall row for the same competitor.
//
//   pnpm db:standings-check     (needs pnpm dev:accounts to have run)
import { createClient } from "@supabase/supabase-js";
import { requireLocal } from "./env";

const DIVISION_ID = "00000000-0000-0000-0000-000000000040"; // seed.sql
const EVENT_ID = "00000000-0000-0000-0000-000000000010";
const ATHLETE_IDS = [61, 62, 63, 64, 65, 66].map((n) => `00000000-0000-0000-0000-0000000000${n}`);
const CONCURRENT_WRITES = 12;

const target = requireLocal();
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(target.apiUrl, target.secretKey, options);

let failures = 0;
function expect(label: string, pass: boolean, detail?: unknown) {
  if (!pass) failures += 1;
  console.log(
    `${pass ? "ok  " : "FAIL"}  ${label}${pass || detail === undefined ? "" : `  -> ${JSON.stringify(detail)}`}`,
  );
}

async function overallRows() {
  const { data, error } = await service
    .from("standings")
    .select("athlete_id, placement, points")
    .eq("division_id", DIVISION_ID)
    .is("wod_id", null);
  if (error) throw new Error(error.message);
  return data;
}

async function main() {
  const scorekeeper = createClient(
    target.apiUrl,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    options,
  );
  const { error: signInError } = await scorekeeper.auth.signInWithPassword({
    email: "scorekeeper@repone.test",
    password: "Repone1234!",
  });
  if (signInError) {
    console.error(
      `Cannot sign in as scorekeeper (${signInError.message}). Run \`pnpm dev:accounts\`.`,
    );
    process.exit(1);
  }

  const before = await overallRows();
  try {
    console.log("\nC3 concurrent standings rewrites");
    // Each writer publishes a different ordering, as two saves computed from
    // slightly different results would.
    const writes = Array.from({ length: CONCURRENT_WRITES }, (_, w) =>
      scorekeeper.rpc("replace_standings", {
        p_division_id: DIVISION_ID,
        p_wod_id: null,
        p_rows: ATHLETE_IDS.map((id, i) => ({
          athlete_id: id,
          team_id: null,
          placement: ((i + w) % ATHLETE_IDS.length) + 1,
          points: ((i + w) % ATHLETE_IDS.length) + 1,
        })),
      }),
    );
    const results = await Promise.all(writes);
    const errors = results.filter((r) => r.error).map((r) => r.error?.message);
    expect("every concurrent rewrite succeeds", errors.length === 0, errors);

    const rows = await overallRows();
    const distinct = new Set(rows.map((r) => r.athlete_id));
    expect(
      `leaderboard has exactly one overall row per athlete (${ATHLETE_IDS.length})`,
      rows.length === ATHLETE_IDS.length && distinct.size === ATHLETE_IDS.length,
      { rows: rows.length, distinct: distinct.size },
    );

    console.log("\nOverall rows are unique per competitor");
    const dup = await service.from("standings").insert([
      {
        event_id: EVENT_ID,
        division_id: DIVISION_ID,
        wod_id: null,
        athlete_id: ATHLETE_IDS[0],
        placement: 1,
        points: 1,
      },
    ]);
    expect("a second overall row for the same athlete is rejected", !!dup.error, dup.status);

    const both = await service.from("standings").insert([
      {
        event_id: EVENT_ID,
        division_id: DIVISION_ID,
        wod_id: null,
        athlete_id: null,
        team_id: null,
        placement: 1,
        points: 1,
      },
    ]);
    expect("a standings row must name an athlete or a team", !!both.error, both.status);
  } finally {
    // Restore whatever overall rows the division had before.
    await service.from("standings").delete().eq("division_id", DIVISION_ID).is("wod_id", null);
    if (before.length) {
      await service
        .from("standings")
        .insert(
          before.map((r) => ({ ...r, event_id: EVENT_ID, division_id: DIVISION_ID, wod_id: null })),
        );
    }
  }

  console.log(failures ? `\n${failures} check(s) FAILED\n` : "\nAll checks passed\n");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
