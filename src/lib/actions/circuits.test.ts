import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./testing/fakeSupabase";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.current }));
vi.mock("@/lib/auth/guards", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/guards")>()),
  requireOrgManager: async () => ({ organizationId: "org-1" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createCircuit, deleteCircuit } from "./circuits";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

beforeEach(() => vi.clearAllMocks());

describe("createCircuit", () => {
  it("asks for a name on its field", async () => {
    db.current = fakeSupabase({}).client;
    expect(await createCircuit(form({ name: "" }))).toEqual({
      ok: false,
      message: "Circuit name is required.",
      fieldErrors: { name: ["Circuit name is required."] },
    });
  });

  it("sends the person to the new circuit", async () => {
    db.current = fakeSupabase({ circuits: [{ data: { id: "ci-1" } }] }).client;
    expect(await createCircuit(form({ name: "Copa 2027" }))).toEqual({
      ok: true,
      data: { href: "/admin/circuits/ci-1" },
    });
  });
});

describe("deleteCircuit", () => {
  it("sends the person back to the circuits list", async () => {
    db.current = fakeSupabase({ circuits: [{ data: [{ id: "ci-1" }] }] }).client;
    expect(await deleteCircuit("ci-1")).toEqual({ ok: true, data: { href: "/admin/circuits" } });
  });
});
