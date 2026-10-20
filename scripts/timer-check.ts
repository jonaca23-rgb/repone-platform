// Proves the broadcast timer's state machine on the LOCAL stack, as the
// assigned producer: every command runs through timer_command() (one locked
// row, the database clock), so double clicks and two operators can't lose or
// invent time.
//
//   pnpm db:timer-check     (needs pnpm dev:accounts to have run)
import { createClient } from "@supabase/supabase-js";
import { signInAs } from "./auth-helpers";
import { requireLocal } from "./env";

const FLOOR_ID = "00000000-0000-0000-0000-000000000030"; // seed.sql "Floor A"
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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface TimerRow {
  timer_status: string;
  timer_elapsed_at_anchor: number;
  timer_anchor_time: string | null;
  timer_duration_seconds: number;
  timer_direction: string;
  active_graphic: string;
}

async function signIn(email: string) {
  try {
    return (await signInAs(email)).db;
  } catch (e) {
    console.error(
      `Cannot sign in as ${email} (${e instanceof Error ? e.message : e}). Run \`pnpm dev:accounts\`.`,
    );
    process.exit(1);
  }
}

async function read(): Promise<TimerRow> {
  const { data, error } = await service
    .from("broadcast_state")
    .select(
      "timer_status, timer_elapsed_at_anchor, timer_anchor_time, timer_duration_seconds, timer_direction, active_graphic",
    )
    .eq("floor_id", FLOOR_ID)
    .single();
  if (error) throw new Error(error.message);
  return { ...data, timer_elapsed_at_anchor: Number(data.timer_elapsed_at_anchor) };
}

async function main() {
  const producer = await signIn("producer@repone.test");
  const athlete = await signIn("athlete@repone.test");
  const before = await read();
  const cmd = (command: string, extra: Record<string, unknown> = {}) =>
    producer.rpc("timer_command", { p_floor_id: FLOOR_ID, p_command: command, ...extra });

  try {
    console.log("\nStart / pause / resume");
    let r = await cmd("start", { p_direction: "count_down", p_duration_seconds: 900 });
    let s = await read();
    expect(
      "start runs the timer from 0 and shows the timer graphic",
      !r.error &&
        s.timer_status === "running" &&
        s.timer_elapsed_at_anchor === 0 &&
        !!s.timer_anchor_time &&
        s.active_graphic === "timer",
      r.error ?? s,
    );

    await sleep(1200);
    r = await cmd("pause");
    s = await read();
    expect(
      "pause banks the elapsed time (~1.2s)",
      !r.error &&
        s.timer_status === "paused" &&
        s.timer_anchor_time === null &&
        s.timer_elapsed_at_anchor >= 1 &&
        s.timer_elapsed_at_anchor < 3,
      r.error ?? s,
    );
    const banked = s.timer_elapsed_at_anchor;

    await cmd("pause");
    s = await read();
    expect(
      "pause while paused changes nothing",
      s.timer_status === "paused" && s.timer_elapsed_at_anchor === banked,
      s,
    );

    r = await cmd("resume");
    const firstAnchor = (await read()).timer_anchor_time;
    await sleep(600);
    await cmd("resume"); // the double click
    s = await read();
    expect(
      "a second resume while running keeps the original anchor",
      !r.error &&
        s.timer_status === "running" &&
        s.timer_anchor_time === firstAnchor &&
        s.timer_elapsed_at_anchor === banked,
      r.error ?? s,
    );

    console.log("\nConcurrent operators");
    const burst = await Promise.all(
      Array.from({ length: 10 }, (_, i) => cmd(i % 2 ? "pause" : "resume")),
    );
    const errors = burst.filter((b) => b.error).map((b) => b.error?.message);
    s = await read();
    expect("10 concurrent pause/resume calls all succeed", errors.length === 0, errors);
    expect(
      "elapsed time never goes backwards or jumps",
      s.timer_elapsed_at_anchor >= banked && s.timer_elapsed_at_anchor < banked + 5,
      s,
    );

    console.log("\nAdjust and reset");
    await cmd("pause");
    const beforeAdjust = (await read()).timer_elapsed_at_anchor;
    await cmd("adjust", { p_delta_seconds: 10 });
    s = await read();
    expect(
      "+10s on a count-down removes 10s of elapsed time (floored at 0)",
      Math.abs(s.timer_elapsed_at_anchor - Math.max(0, beforeAdjust - 10)) < 0.01 &&
        s.timer_status === "paused",
      s,
    );

    await cmd("reset");
    s = await read();
    expect(
      "reset returns to idle at 0",
      s.timer_status === "idle" && s.timer_elapsed_at_anchor === 0 && s.timer_anchor_time === null,
      s,
    );

    await cmd("resume");
    s = await read();
    expect(
      "resume from idle does nothing (use start)",
      s.timer_status === "idle" && s.timer_anchor_time === null,
      s,
    );

    console.log("\nGuards");
    r = await cmd("explode");
    expect("an unknown command is rejected", !!r.error, r.data);
    const denied = await athlete.rpc("timer_command", {
      p_floor_id: FLOOR_ID,
      p_command: "start",
      p_direction: "count_up",
      p_duration_seconds: 0,
    });
    s = await read();
    expect(
      "an athlete cannot drive the timer",
      !!denied.error && s.timer_status === "idle",
      denied.error ?? s,
    );
    r = await cmd("pause", { p_floor_id: "00000000-0000-0000-0000-00000000dead" });
    expect("a floor without broadcast state is an error, not a silent no-op", !!r.error, r.data);
  } finally {
    await service.from("broadcast_state").update(before).eq("floor_id", FLOOR_ID);
  }

  console.log(failures ? `\n${failures} check(s) FAILED\n` : "\nAll checks passed\n");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
