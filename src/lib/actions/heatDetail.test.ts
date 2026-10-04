import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./testing/fakeSupabase";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.current }));
const HEAT = {
  id: "h-1",
  event_id: "ev-1",
  wod_id: "w-1",
  division_id: "d-1",
  floor_id: "f-1",
};
vi.mock("@/lib/auth/guards", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/guards")>()),
  requireHeatAccess: async () => ({ ctx: { userId: "u-1" }, eventId: "ev-1", heat: HEAT }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { assignLane } from "./lanes";
import { saveHeatResults } from "./results";

const ATHLETE = "00000000-0000-4000-8000-000000000066";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

beforeEach(() => vi.clearAllMocks());

describe("assignLane", () => {
  it("names the lane the athlete already holds in this heat", async () => {
    db.current = fakeSupabase({
      registrations: [{ data: { id: "r-1" } }],
      divisions: [{ data: { name: "Intermediate Female" } }],
      lanes: [{ data: [{ lane_number: 2, heat_id: "h-1", heats: { heat_number: 6 } }] }],
    }).client;
    expect(await assignLane("ev-1", "h-1", "l-3", form({ athlete_id: ATHLETE }))).toEqual({
      ok: false,
      message:
        "This athlete is already assigned to Lane 2 in this heat (Intermediate Female) — remove them from that lane first.",
    });
  });

  it("refuses a heat from another event", async () => {
    db.current = fakeSupabase({}).client;
    expect(await assignLane("ev-9", "h-1", "l-3", form({ athlete_id: "" }))).toEqual({
      ok: false,
      message: "That heat isn't part of this event.",
    });
  });

  it("clears a lane", async () => {
    db.current = fakeSupabase({ lanes: [{ data: [{ id: "l-3" }] }] }).client;
    expect(await assignLane("ev-1", "h-1", "l-3", form({ athlete_id: "" }))).toEqual({ ok: true });
  });
});

describe("saveHeatResults", () => {
  it("refuses a bad athlete list", async () => {
    db.current = fakeSupabase({}).client;
    expect(
      await saveHeatResults("ev-1", "h-1", "w-1", "d-1", "for_time", "f-1", ["nope"], form({})),
    ).toEqual({ ok: false, message: "The list of athletes isn't valid." });
  });

  it("goes back to the heats list after saving", async () => {
    db.current = fakeSupabase({}).client;
    expect(
      await saveHeatResults("ev-1", "h-1", "w-1", "d-1", "for_time", "f-1", [], form({})),
    ).toEqual({ ok: true, data: { href: "/admin/events/ev-1/heats" } });
  });
});
