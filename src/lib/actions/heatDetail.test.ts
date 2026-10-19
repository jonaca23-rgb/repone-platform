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

const ATHLETE = "00000000-0000-4000-8000-000000000066";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

beforeEach(() => vi.clearAllMocks());

const TEAM = "00000000-0000-4000-8000-0000000000a1";
const individual = { data: { name: "Intermediate Female", entry_format: "individual" } };
const pairs = { data: { name: "Intermediate Pairs", entry_format: "pair" } };
const updated = (fake: ReturnType<typeof fakeSupabase>) =>
  fake.calls.find(([t, m]) => t === "lanes" && m === "update")?.[2][0];

describe("assignLane", () => {
  it("names the lane the athlete already holds in this heat", async () => {
    db.current = fakeSupabase({
      divisions: [individual],
      registrations: [{ data: { id: "r-1" } }],
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

  it("clears a lane of whoever is in it", async () => {
    const fake = fakeSupabase({ divisions: [pairs], lanes: [{ data: [{ id: "l-3" }] }] });
    db.current = fake.client;
    expect(await assignLane("ev-1", "h-1", "l-3", form({ team_id: "" }))).toEqual({ ok: true });
    expect(updated(fake)).toEqual({ athlete_id: null, team_id: null });
  });

  it("puts a team in a team division's lane, clearing any athlete", async () => {
    const fake = fakeSupabase({
      divisions: [pairs],
      registrations: [{ data: { id: "r-9" } }],
      lanes: [{ data: [] }, { data: [{ id: "l-3" }] }],
    });
    db.current = fake.client;
    expect(await assignLane("ev-1", "h-1", "l-3", form({ team_id: TEAM }))).toEqual({ ok: true });
    expect(updated(fake)).toEqual({ athlete_id: null, team_id: TEAM });
  });

  it("puts an athlete in an individual lane, clearing any team", async () => {
    const fake = fakeSupabase({
      divisions: [individual],
      registrations: [{ data: { id: "r-1" } }],
      lanes: [{ data: [] }, { data: [{ id: "l-3" }] }],
    });
    db.current = fake.client;
    expect(await assignLane("ev-1", "h-1", "l-3", form({ athlete_id: ATHLETE }))).toEqual({
      ok: true,
    });
    expect(updated(fake)).toEqual({ athlete_id: ATHLETE, team_id: null });
  });

  it("refuses an athlete in a team division, and a team in an individual one", async () => {
    db.current = fakeSupabase({ divisions: [pairs] }).client;
    expect(await assignLane("ev-1", "h-1", "l-3", form({ athlete_id: ATHLETE }))).toEqual({
      ok: false,
      message: "This heat's division is for teams. Choose a team.",
    });
    db.current = fakeSupabase({ divisions: [individual] }).client;
    expect(await assignLane("ev-1", "h-1", "l-3", form({ team_id: TEAM }))).toEqual({
      ok: false,
      message: "This heat's division is for individuals. Choose an athlete.",
    });
  });

  it("names the heat and lane a team already holds", async () => {
    db.current = fakeSupabase({
      divisions: [pairs],
      registrations: [{ data: { id: "r-9" } }],
      lanes: [{ data: [{ lane_number: 4, heat_id: "h-2", heats: { heat_number: 2 } }] }],
    }).client;
    expect(await assignLane("ev-1", "h-1", "l-3", form({ team_id: TEAM }))).toEqual({
      ok: false,
      message:
        "This team is already in Heat 2, Lane 4 (Intermediate Pairs) — remove it from there first.",
    });
  });
});
