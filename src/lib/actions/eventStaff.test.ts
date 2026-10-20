import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./testing/fakeSupabase";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.current }));
vi.mock("@/lib/auth/guards", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/guards")>()),
  requireEventAccess: async () => ({ ctx: { userId: "u-admin" }, organizationId: "org-1" }),
}));
const can = vi.hoisted(() => ({ value: true }));
vi.mock("@/lib/auth/session", () => ({ orgCan: () => can.value }));
const invite = vi.hoisted(() => ({
  inviteToEvent: vi.fn(),
  pendingEmail: vi.fn(),
  resendInvitation: vi.fn(),
}));
vi.mock("@/lib/auth/invite", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/invite")>()),
  ...invite,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { inviteEventStaff, removeEventProducer, resendEventInvite } from "./eventStaff";

const EVENT = "00000000-0000-4000-8000-000000000010";
const PERSON = "00000000-0000-4000-8000-000000000201";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  can.value = true;
});

describe("event staff", () => {
  it("invites and says so", async () => {
    db.current = fakeSupabase({ events: [{ data: { name: "Aprieta" } }] }).client;
    invite.inviteToEvent.mockResolvedValue({ created: false, emailSent: true });
    expect(await inviteEventStaff("producer", EVENT, form({ email: "p@example.com" }))).toEqual({
      ok: true,
      message: "Access granted and notified.",
    });
  });

  it("refuses someone who can't manage staff", async () => {
    can.value = false;
    db.current = fakeSupabase({}).client;
    expect(await inviteEventStaff("producer", EVENT, form({ email: "p@example.com" }))).toEqual({
      ok: false,
      message: "Only an admin or event director can manage event staff.",
    });
  });

  it("has nothing to resend to someone who already signed in", async () => {
    db.current = fakeSupabase({ event_producer_assignments: [{ data: [{ id: "a-1" }] }] }).client;
    invite.pendingEmail.mockResolvedValue(null);
    expect(await resendEventInvite(EVENT, PERSON)).toEqual({
      ok: false,
      message: "They have already signed in; there's nothing to resend.",
    });
  });

  it("removes a producer", async () => {
    db.current = fakeSupabase({ event_producer_assignments: [{ data: [{ id: "a-1" }] }] }).client;
    expect(await removeEventProducer(EVENT, "a-1")).toEqual({ ok: true });
  });
});
