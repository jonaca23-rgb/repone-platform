import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./testing/fakeSupabase";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.current }));
vi.mock("@/lib/auth/guards", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/guards")>()),
  requireEventAccess: async () => ({ ctx: { userId: "u-admin" }, organizationId: "org-1" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  markPaymentStatus,
  markPaymentStatusForCheckin,
  updateRegistrationPayment,
} from "./payments";

const ATHLETE = "00000000-0000-4000-8000-000000000066";
const FEE = "00000000-0000-4000-8000-000000000090";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

beforeEach(() => vi.clearAllMocks());

describe("updateRegistrationPayment", () => {
  it("puts a bad amount on its field", async () => {
    db.current = fakeSupabase({}).client;
    expect(
      await updateRegistrationPayment(
        "ev-1",
        "r-1",
        form({ status: "paid", payment_method: "cash", amount_dollars: "-1" }),
      ),
    ).toEqual({
      ok: false,
      message: "Enter a valid amount.",
      fieldErrors: { amount_dollars: ["Enter a valid amount."] },
    });
  });

  it("refuses another event's fee on its field", async () => {
    db.current = fakeSupabase({
      registrations: [{ data: { id: "r-1" } }],
      fee_schedules: [{ data: null }],
    }).client;
    expect(
      await updateRegistrationPayment(
        "ev-1",
        "r-1",
        form({ status: "paid", payment_method: "cash", fee_schedule_id: FEE }),
      ),
    ).toEqual({
      ok: false,
      message: "That fee isn't part of this event.",
      fieldErrors: { fee_schedule_id: ["Choose one of this event's fees."] },
    });
  });

  it("saves the payment", async () => {
    db.current = fakeSupabase({
      registrations: [{ data: { id: "r-1" } }],
      payments: [{ error: null }],
    }).client;
    expect(
      await updateRegistrationPayment(
        "ev-1",
        "r-1",
        form({ status: "paid", payment_method: "cash", amount_dollars: "75" }),
      ),
    ).toEqual({ ok: true });
  });
});

describe("markPaymentStatus", () => {
  it("refuses a registration from another event", async () => {
    db.current = fakeSupabase({ registrations: [{ data: null }] }).client;
    expect(await markPaymentStatus("ev-1", "r-9", "paid")).toEqual({
      ok: false,
      message: "That registration isn't part of this event.",
    });
  });

  it("marks paid", async () => {
    db.current = fakeSupabase({
      registrations: [{ data: { id: "r-1" } }],
      payments: [{ data: null }, { error: null }],
    }).client;
    expect(await markPaymentStatus("ev-1", "r-1", "paid")).toEqual({ ok: true });
  });

  it("refuses an unknown status", async () => {
    db.current = fakeSupabase({}).client;
    // @ts-expect-error: a value from the browser need not be a known status.
    expect(await markPaymentStatusForCheckin(ATHLETE, "ev-1", "r-1", "free")).toEqual({
      ok: false,
      message: "Choose a valid payment status.",
    });
  });
});
