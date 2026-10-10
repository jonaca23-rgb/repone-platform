import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./testing/fakeSupabase";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.current }));
vi.mock("@/lib/auth/guards", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/guards")>()),
  requireEventAccess: async () => ({ ctx: { userId: "u-1" }, organizationId: "org-1" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createDisplay, toggleDisplayEnabled, updateDisplaySettings } from "./displays";

const EVENT = "00000000-0000-4000-8000-000000000010";
const FLOOR = "00000000-0000-4000-8000-000000000030";
const DISPLAY = "00000000-0000-4000-8000-000000000090";
const OTHER_FLOOR = "That floor isn't part of this event.";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}
const settings = {
  sponsors_enabled: "on",
  info_blocks_between_sponsors: "1",
  current_heat_enabled: "on",
  current_heat_duration: "15",
  current_heat_weight: "2",
  next_heat_duration: "12",
  next_heat_weight: "1",
  leaderboard_enabled: "on",
  leaderboard_duration: "15",
  leaderboard_weight: "2",
};

beforeEach(() => vi.clearAllMocks());

describe("createDisplay", () => {
  it("adds a display on one of the event's floors", async () => {
    const fake = fakeSupabase({ display_devices: [{ error: null }] });
    db.current = fake.client;
    expect(await createDisplay(EVENT, form({ name: "Entrance", floor_id: FLOOR }))).toEqual({
      ok: true,
    });
    expect(fake.calls).toContainEqual([
      "display_devices",
      "insert",
      [{ event_id: EVENT, floor_id: FLOOR, name: "Entrance" }],
    ]);
  });

  it("refuses a floor of another event", async () => {
    db.current = fakeSupabase({
      display_devices: [
        { error: { message: "display_floor_event: floor x is not part of event y" } },
      ],
    }).client;
    expect(await createDisplay(EVENT, form({ name: "Entrance", floor_id: FLOOR }))).toEqual({
      ok: false,
      message: OTHER_FLOOR,
      fieldErrors: { floor_id: [OTHER_FLOOR] },
    });
  });
});

describe("updateDisplaySettings", () => {
  it("saves the device and its three blocks", async () => {
    const fake = fakeSupabase({
      display_devices: [{ data: [{ id: DISPLAY }] }],
      display_blocks: [{ error: null }],
    });
    db.current = fake.client;
    expect(await updateDisplaySettings(EVENT, DISPLAY, form(settings))).toEqual({ ok: true });
    expect(fake.calls).toContainEqual([
      "display_devices",
      "update",
      [{ sponsors_enabled: true, info_blocks_between_sponsors: 1 }],
    ]);
    expect(fake.calls).toContainEqual([
      "display_blocks",
      "upsert",
      [
        [
          {
            display_id: DISPLAY,
            block_type: "current_heat",
            enabled: true,
            duration_seconds: 15,
            weight: 2,
          },
          {
            display_id: DISPLAY,
            block_type: "next_heat",
            enabled: false,
            duration_seconds: 12,
            weight: 1,
          },
          {
            display_id: DISPLAY,
            block_type: "leaderboard",
            enabled: true,
            duration_seconds: 15,
            weight: 2,
          },
        ],
        { onConflict: "display_id,block_type" },
      ],
    ]);
  });

  it("refuses a block shorter than 5 seconds on its field", async () => {
    db.current = fakeSupabase({}).client;
    const result = await updateDisplaySettings(
      EVENT,
      DISPLAY,
      form({ ...settings, leaderboard_duration: "4" }),
    );
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: { leaderboard_duration: ["Leaderboard seconds must be at least 5."] },
    });
  });
});

describe("toggleDisplayEnabled", () => {
  it("switches a display of this event", async () => {
    const fake = fakeSupabase({ display_devices: [{ data: [{ id: DISPLAY }] }] });
    db.current = fake.client;
    expect(await toggleDisplayEnabled(EVENT, DISPLAY, false)).toEqual({ ok: true });
    expect(fake.calls).toContainEqual(["display_devices", "eq", ["event_id", EVENT]]);
  });

  it("says so when the display isn't this event's", async () => {
    db.current = fakeSupabase({ display_devices: [{ data: [] }] }).client;
    expect(await toggleDisplayEnabled(EVENT, DISPLAY, false)).toMatchObject({ ok: false });
  });
});
