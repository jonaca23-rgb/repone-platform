import { beforeEach, describe, expect, it, vi } from "vitest";
import { WEIGHT_LIFT_NAMES } from "@/lib/constants/lifts";
import { fakeSupabase } from "./testing/fakeSupabase";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.current }));
vi.mock("@/lib/auth/guards", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/guards")>()),
  requireSignedIn: async () => ({ userId: "u-1" }),
}));
vi.mock("@/lib/auth/session", () => ({
  getAthleteSessionContext: async () => ({ athleteId: "a-1", organizationId: "o-1" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { saveMyLifts, upsertMyBenchmark } from "./myLifts";

const form = (values: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
};

beforeEach(() => vi.clearAllMocks());

describe("athlete's own lifts", () => {
  it("says so when every field is blank", async () => {
    db.current = fakeSupabase({}).client;
    expect(await saveMyLifts(form({}))).toEqual({
      ok: false,
      message: "Enter at least one lift or time to save.",
    });
  });

  it("saves a lift", async () => {
    const fake = fakeSupabase({ athlete_lifts: [{ data: null }] });
    db.current = fake.client;
    expect(await saveMyLifts(form({ [WEIGHT_LIFT_NAMES[0]]: "225" }))).toEqual({ ok: true });
    expect(fake.calls.some(([t, m]) => t === "athlete_lifts" && m === "upsert")).toBe(true);
  });

  it("saves a benchmark", async () => {
    db.current = fakeSupabase({ athlete_benchmarks: [{ data: null }] }).client;
    expect(await upsertMyBenchmark(form({ name: "Fran", result_display: "3:45" }))).toEqual({
      ok: true,
    });
  });
});
