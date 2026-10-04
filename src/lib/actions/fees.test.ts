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

import { createFeeSchedule, deleteFeeSchedule, toggleFeeScheduleActive } from "./fees";

const DIVISION = "00000000-0000-4000-8000-000000000040";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

beforeEach(() => vi.clearAllMocks());

describe("fees", () => {
  it("puts a bad amount on its field", async () => {
    db.current = fakeSupabase({}).client;
    expect(await createFeeSchedule("ev-1", form({ name: "Entry", amount_dollars: "-5" }))).toEqual({
      ok: false,
      message: "Enter a valid fee amount.",
      fieldErrors: { amount_dollars: ["Enter a valid fee amount."] },
    });
  });

  it("refuses another event's division", async () => {
    db.current = fakeSupabase({ divisions: [{ data: null }] }).client;
    expect(
      await createFeeSchedule(
        "ev-1",
        form({ name: "Entry", amount_dollars: "75", division_id: DIVISION }),
      ),
    ).toEqual({
      ok: false,
      message: "That division isn't part of this event.",
      fieldErrors: { division_id: ["Choose one of this event's divisions."] },
    });
  });

  it("adds, switches and deletes a fee", async () => {
    db.current = fakeSupabase({
      fee_schedules: [{ error: null }, { data: [{ id: "f-1" }] }, { data: [{ id: "f-1" }] }],
    }).client;
    expect(await createFeeSchedule("ev-1", form({ name: "Entry", amount_dollars: "75" }))).toEqual({
      ok: true,
    });
    expect(await toggleFeeScheduleActive("ev-1", "f-1", false)).toEqual({ ok: true });
    expect(await deleteFeeSchedule("ev-1", "f-1")).toEqual({ ok: true });
  });
});
