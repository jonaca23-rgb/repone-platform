import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./testing/fakeSupabase";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.current }));
vi.mock("@/lib/auth/guards", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/guards")>()),
  requireSignedIn: async () => ({ userId: "u-1" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { sendMessage } from "./messages";

const TO = "00000000-0000-4000-8000-000000000002";
const body = (text: string) => {
  const fd = new FormData();
  fd.set("body", text);
  return fd;
};

beforeEach(() => vi.clearAllMocks());

describe("sendMessage", () => {
  it("says so when the person can't be messaged", async () => {
    db.current = fakeSupabase({ messages: [{ error: { message: "rls", code: "42501" } }] }).client;
    expect(await sendMessage(TO, body("Hi"))).toEqual({
      ok: false,
      message: "You can't message this person.",
    });
  });

  it("sends", async () => {
    db.current = fakeSupabase({ messages: [{ data: null }] }).client;
    expect(await sendMessage(TO, body("Hi"))).toEqual({ ok: true });
  });
});
