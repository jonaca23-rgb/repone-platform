import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./testing/fakeSupabase";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.current }));
const HEAT = { id: "h-1", event_id: "ev-1", wod_id: "w-1", division_id: "d-1", floor_id: "f-1" };
const access = vi.hoisted(() => ({ endedAt: null as string | null, manager: false }));
vi.mock("@/lib/auth/guards", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/guards")>()),
  requireHeatAccess: async () => ({
    ctx: { userId: "u-1" },
    eventId: "ev-1",
    organizationId: "org-1",
    heat: { ...HEAT, ended_at: access.endedAt },
  }),
  isOrgManager: () => access.manager,
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

beforeEach(() => {
  vi.clearAllMocks();
  access.endedAt = null;
  access.manager = false;
});

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

describe("enterResult on a finished heat", () => {
  const card = () => form({ competitor_id: ATHLETE, time_seconds: "3:45" });

  it("refuses a scorekeeper and says who can correct it", async () => {
    access.endedAt = "2026-10-12T15:00:00Z";
    const fake = laned({ results: [{ data: null }] });
    db.current = fake.client;
    expect(await enterResult("h-1", card())).toEqual({
      ok: false,
      message: "This heat is finished. An admin or event director can correct its results.",
    });
    expect(fake.calls.some(([t, m]) => t === "results" && m === "upsert")).toBe(false);
  });

  it("lets an admin or event director correct it", async () => {
    access.endedAt = "2026-10-12T15:00:00Z";
    access.manager = true;
    db.current = laned({ results: [{ data: null }] }).client;
    expect(await enterResult("h-1", card())).toEqual({ ok: true });
  });
});

describe("finishHeat", () => {
  it("says so when the heat is already finished", async () => {
    access.endedAt = "2026-10-12T15:00:00Z";
    const fake = fakeSupabase({});
    db.current = fake.client;
    expect(await finishHeat("h-1")).toEqual({
      ok: false,
      message: "This heat is already finished.",
    });
    expect(fake.calls.some(([t, m]) => t === "heats" && m === "update")).toBe(false);
  });

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
