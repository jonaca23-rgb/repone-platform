import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./testing/fakeSupabase";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.current }));
vi.mock("@/lib/auth/guards", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/guards")>()),
  requireFloorAccess: async (floorId: string) => ({
    ctx: { userId: "u-1" },
    eventId: "ev-1",
    organizationId: "org-1",
    floorId,
  }),
}));

import { clearGraphics, setActiveGraphic, setCurrentHeat, startTimer } from "./broadcast";

const FLOOR = "00000000-0000-4000-8000-000000000030";
const HEAT = "00000000-0000-4000-8000-000000000070";

beforeEach(() => vi.clearAllMocks());

describe("broadcast actions", () => {
  it("refuses a heat that isn't on the floor", async () => {
    db.current = fakeSupabase({ heats: [{ data: null }] }).client;
    expect(await setCurrentHeat(FLOOR, HEAT)).toEqual({
      ok: false,
      message: "That heat isn't on this floor.",
    });
  });

  it("puts a heat on air", async () => {
    db.current = fakeSupabase({
      heats: [{ data: { id: HEAT } }],
      broadcast_state: [{ data: [{ floor_id: FLOOR }] }],
    }).client;
    expect(await setCurrentHeat(FLOOR, HEAT)).toEqual({ ok: true });
  });

  it("shows a graphic", async () => {
    db.current = fakeSupabase({ broadcast_state: [{ data: [{ floor_id: FLOOR }] }] }).client;
    expect(await setActiveGraphic(FLOOR, "lanes")).toEqual({ ok: true });
  });

  it("says so when the floor's controls aren't this account's", async () => {
    db.current = fakeSupabase({ broadcast_state: [{ data: [] }] }).client;
    expect(await setActiveGraphic(FLOOR, "lanes")).toEqual({
      ok: false,
      message: "This floor's broadcast controls aren't available to your account.",
    });
  });

  it("clears the graphics", async () => {
    db.current = fakeSupabase({ broadcast_state: [{ data: [{ floor_id: FLOOR }] }] }).client;
    expect(await clearGraphics(FLOOR)).toEqual({ ok: true });
  });

  it("names a bad timer duration", async () => {
    db.current = fakeSupabase({}).client;
    const result = await startTimer(FLOOR, "count_down", 1.5);
    expect(result).toEqual({ ok: false, message: "Timer duration must be whole seconds." });
  });
});
