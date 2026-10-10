// Proves the venue display devices on the LOCAL stack: the seeded display has
// its default info blocks, the event's producer manages it, anon can read
// but not change it, other staff can't create one, and a display can't follow
// a floor of another event.
//
//   pnpm db:display-check     (needs pnpm dev:accounts and pnpm db:seed:qa)
import { createClient } from "@supabase/supabase-js";
import { signInAs } from "./auth-helpers";
import { requireLocal } from "./env";

const EVENT_ID = "00000000-0000-0000-0000-000000000010";
const FLOOR_ID = "00000000-0000-0000-0000-000000000030";
const DISPLAY_ID = "00000000-0000-0000-0000-000000000090";

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

async function main() {
  const producer = await signIn("producer@repone.test");
  const commentator = await signIn("commentator@repone.test");
  const anon = createClient(target.apiUrl, publishableKey, options);

  const { data: blocks, error } = await service
    .from("display_blocks")
    .select("block_type")
    .eq("display_id", DISPLAY_ID);
  if (error) {
    expect("display_blocks exists", false, error.message);
    process.exit(1);
  }
  expect("seeded display has the 3 default blocks", (blocks ?? []).length === 3, blocks);

  const anonRead = await anon.from("display_devices").select("id").eq("id", DISPLAY_ID);
  expect(
    "anon reads the display (the kiosk is signed out)",
    (anonRead.data ?? []).length === 1,
    anonRead,
  );
  const anonWrite = await anon
    .from("display_devices")
    .update({ name: "Hacked" })
    .eq("id", DISPLAY_ID)
    .select("id");
  expect("anon can't change a display", (anonWrite.data ?? []).length === 0, anonWrite);

  const rename = await producer
    .from("display_devices")
    .update({ name: "Entrance Display" })
    .eq("id", DISPLAY_ID)
    .select("id");
  expect("the event's producer manages its display", (rename.data ?? []).length === 1, rename);

  const staffInsert = await commentator
    .from("display_devices")
    .insert({ event_id: EVENT_ID, floor_id: FLOOR_ID, name: "Check" });
  expect("a commentator can't create a display", !!staffInsert.error, staffInsert.error);

  const { data: otherFloor } = await service
    .from("floors")
    .select("id, venues!inner(event_id)")
    .neq("venues.event_id", EVENT_ID)
    .limit(1)
    .maybeSingle();
  if (!otherFloor) {
    expect("a floor of another event exists (run pnpm db:seed:qa)", false);
  } else {
    const wrongFloor = await service
      .from("display_devices")
      .insert({ event_id: EVENT_ID, floor_id: otherFloor.id, name: "Check" });
    expect(
      "a display can't follow a floor of another event",
      !!wrongFloor.error?.message.includes("display_floor_event"),
      wrongFloor.error,
    );
  }

  if (failures) process.exit(1);
}
void main();
