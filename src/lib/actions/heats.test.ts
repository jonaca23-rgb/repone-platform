import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./testing/fakeSupabase";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.current }));
vi.mock("@/lib/auth/guards", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/guards")>()),
  requireEventAccess: async () => ({ organizationId: "org-1" }),
}));
const jar = vi.hoisted(() => ({ set: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => jar }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createHeat, deleteHeat, generateHeats } from "./heats";

const REFS = {
  floor_id: "00000000-0000-4000-8000-000000000030",
  wod_id: "00000000-0000-4000-8000-000000000050",
  division_id: "00000000-0000-4000-8000-000000000040",
};
const HEAT = "00000000-0000-4000-8000-000000000070";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

const refsFound = () => ({
  floors: [{ data: { id: REFS.floor_id } }],
  wods: [{ data: { id: REFS.wod_id } }],
  divisions: [{ data: { id: REFS.division_id } }],
});

beforeEach(() => vi.clearAllMocks());

describe("generateHeats", () => {
  it("won't generate on top of existing heats", async () => {
    db.current = fakeSupabase({ ...refsFound(), heats: [{ data: [{ id: HEAT }] }] }).client;
    expect(await generateHeats("ev-1", form({ ...REFS, lanes_per_heat: "6" }))).toEqual({
      ok: false,
      message:
        "Heats already exist for this WOD/Division — remove them first (or use Add Single Heat) before generating a new set, so no one ends up double-booked.",
    });
    expect(jar.set).toHaveBeenCalledWith("repone_lanes_per_heat_ev-1", "6", expect.anything());
  });

  it("needs registered participants", async () => {
    db.current = fakeSupabase({
      ...refsFound(),
      heats: [{ data: [] }],
      registrations: [{ data: [] }],
    }).client;
    expect(await generateHeats("ev-1", form({ ...REFS, lanes_per_heat: "6" }))).toEqual({
      ok: false,
      message:
        "No registered athletes/teams found for this division — register participants first.",
    });
  });
});

describe("createHeat", () => {
  it("refuses another event's WOD", async () => {
    db.current = fakeSupabase({
      floors: [{ data: { id: REFS.floor_id } }],
      wods: [{ data: null }],
      divisions: [{ data: { id: REFS.division_id } }],
    }).client;
    expect(await createHeat("ev-1", form({ ...REFS, heat_number: "1" }))).toEqual({
      ok: false,
      message: "That WOD isn't part of this event.",
    });
  });

  it("adds a heat with its lanes", async () => {
    db.current = fakeSupabase({
      ...refsFound(),
      heats: [{ data: { id: HEAT } }],
      lanes: [{ error: null }],
    }).client;
    expect(await createHeat("ev-1", form({ ...REFS, heat_number: "1" }))).toEqual({ ok: true });
  });
});

describe("deleteHeat", () => {
  it("removes a heat", async () => {
    db.current = fakeSupabase({ heats: [{ data: [{ id: HEAT }] }] }).client;
    expect(await deleteHeat("ev-1", HEAT)).toEqual({ ok: true });
  });
});
