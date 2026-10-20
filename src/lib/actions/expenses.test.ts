import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./testing/fakeSupabase";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.current }));
vi.mock("@/lib/auth/guards", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/guards")>()),
  requireEventAccess: async () => ({ ctx: { userId: "u-1" }, organizationId: "org-1" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createExpense, deleteExpense } from "./expenses";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

beforeEach(() => vi.clearAllMocks());

describe("expenses", () => {
  it("puts a bad amount on its field", async () => {
    db.current = fakeSupabase({}).client;
    expect(
      await createExpense(
        "ev-1",
        form({ category: "venue", description: "Deposit", amount_dollars: "-1" }),
      ),
    ).toEqual({
      ok: false,
      message: "Enter a valid expense amount.",
      fieldErrors: { amount_dollars: ["Enter a valid expense amount."] },
    });
  });

  it("logs and removes an expense", async () => {
    db.current = fakeSupabase({ expenses: [{ error: null }, { data: [{ id: "x-1" }] }] }).client;
    expect(
      await createExpense(
        "ev-1",
        form({ category: "venue", description: "Deposit", amount_dollars: "250" }),
      ),
    ).toEqual({ ok: true });
    expect(await deleteExpense("ev-1", "x-1")).toEqual({ ok: true });
  });
});
