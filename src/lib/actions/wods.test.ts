import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./testing/fakeSupabase";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.current }));
vi.mock("@/lib/auth/guards", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/guards")>()),
  requireEventAccess: async () => ({ organizationId: "org-1" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createWod, deleteWod, updateWod } from "./wods";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

const WOD = { name: "WOD 2", scoring_type: "for_time", tiebreak_type: "none" };

beforeEach(() => vi.clearAllMocks());

describe("WODs", () => {
  it("puts a negative time cap on its field", async () => {
    db.current = fakeSupabase({}).client;
    const result = await createWod("ev-1", form({ ...WOD, time_cap_minutes: "-3" }));
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.fieldErrors?.time_cap_minutes).toBeTruthy();
  });

  it("adds, saves and removes a WOD", async () => {
    db.current = fakeSupabase({
      wods: [{ error: null }, { data: [{ id: "w-1" }] }, { data: [{ id: "w-1" }] }],
    }).client;
    expect(await createWod("ev-1", form(WOD))).toEqual({ ok: true });
    expect(await updateWod("ev-1", "w-1", form(WOD))).toEqual({ ok: true });
    expect(await deleteWod("ev-1", "w-1")).toEqual({ ok: true });
  });

  it("says when the WOD to save is gone", async () => {
    db.current = fakeSupabase({ wods: [{ data: [] }] }).client;
    expect(await updateWod("ev-1", "w-9", form(WOD))).toEqual({
      ok: false,
      message: "Couldn't save the WOD: not found, or not yours.",
    });
  });
});
