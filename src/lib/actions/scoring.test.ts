import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./testing/fakeSupabase";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.current }));
const HEAT = { id: "h-1", event_id: "ev-1", wod_id: "w-1", division_id: "d-1", floor_id: "f-1" };
vi.mock("@/lib/auth/guards", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/guards")>()),
  requireHeatAccess: async () => ({ ctx: { userId: "u-1" }, eventId: "ev-1", heat: HEAT }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/scoring/recompute", () => ({
  recomputeWodStandings: vi.fn(async () => {}),
  recomputeOverallStandings: vi.fn(async () => {}),
}));

import { finishHeat } from "./heats";
import { enterResult } from "./results";

const ATHLETE = "00000000-0000-4000-8000-000000000066";
const OTHER = "00000000-0000-4000-8000-000000000077";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

function laned(extra: Record<string, { data?: unknown; error?: { message: string } }[]> = {}) {
  return fakeSupabase({
    wods: [{ data: { scoring_type: "for_time" } }],
    lanes: [{ data: [{ athlete_id: ATHLETE, team_id: null }] }],
    registrations: [{ data: [] }],
    ...extra,
  });
}

beforeEach(() => vi.clearAllMocks());

describe("enterResult", () => {
  it("refuses a competitor outside the heat", async () => {
    db.current = laned().client;
    expect(await enterResult("h-1", form({ competitor_id: OTHER, time_seconds: "3:45" }))).toEqual({
      ok: false,
      message: "That competitor isn't in this heat.",
    });
  });

  it("names a bad time on the time field", async () => {
    db.current = laned().client;
    const result = await enterResult("h-1", form({ competitor_id: ATHLETE, time_seconds: "3:7x" }));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.fieldErrors?.time_seconds?.[0]).toMatch(/Time must be a time like/);
  });

  it("saves a valid card", async () => {
    const fake = laned({ results: [{ data: null }] });
    db.current = fake.client;
    expect(
      await enterResult("h-1", form({ competitor_id: ATHLETE, time_seconds: "3:45" })),
    ).toEqual({ ok: true });
    const upsert = fake.calls.find(([t, m]) => t === "results" && m === "upsert");
    expect(upsert?.[2][0]).toMatchObject({ athlete_id: ATHLETE, time_seconds: 225 });
  });
});

describe("finishHeat", () => {
  it("says which heat finished", async () => {
    db.current = fakeSupabase({ heats: [{ data: [{ id: "h-1", heat_number: 6 }] }] }).client;
    expect(await finishHeat("h-1")).toEqual({ ok: true, message: "Heat 6 finished." });
  });

  it("fails when the heat didn't change", async () => {
    db.current = fakeSupabase({ heats: [{ data: [] }] }).client;
    const result = await finishHeat("h-1");
    expect(result.ok).toBe(false);
  });
});
