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

import { createDivision, deleteDivision } from "./divisions";
import { addFloor } from "./venues";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

beforeEach(() => vi.clearAllMocks());

describe("divisions", () => {
  it("asks for a division name on its field", async () => {
    db.current = fakeSupabase({}).client;
    expect(await createDivision("ev-1", form({ name: "" }))).toEqual({
      ok: false,
      message: "Division name is required.",
      fieldErrors: { name: ["Division name is required."] },
    });
  });

  it("adds and removes a division", async () => {
    db.current = fakeSupabase({ divisions: [{ error: null }, { data: [{ id: "d-1" }] }] }).client;
    expect(await createDivision("ev-1", form({ name: "Intermediate Female" }))).toEqual({
      ok: true,
    });
    expect(await deleteDivision("ev-1", "d-1")).toEqual({ ok: true });
  });
});

describe("addFloor", () => {
  it("refuses a venue from another event", async () => {
    db.current = fakeSupabase({ venues: [{ data: null }] }).client;
    expect(await addFloor("ev-1", "ve-9", form({ name: "Floor B" }))).toEqual({
      ok: false,
      message: "That venue doesn't belong to this event.",
    });
  });

  it("adds a floor with its broadcast state", async () => {
    db.current = fakeSupabase({
      venues: [{ data: { id: "ve-1" } }],
      floors: [{ data: { id: "fl-2" } }],
      broadcast_state: [{ error: null }],
    }).client;
    expect(await addFloor("ev-1", "ve-1", form({ name: "Floor B" }))).toEqual({ ok: true });
  });
});
