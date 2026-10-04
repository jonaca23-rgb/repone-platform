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

import { createAthlete, deleteAthlete } from "./athletes";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

const MARIA = { first_name: "Maria", last_name: "Rivera", email: "maria@example.com" };

beforeEach(() => vi.clearAllMocks());

describe("createAthlete", () => {
  it("puts a duplicate email on the email field", async () => {
    db.current = fakeSupabase({
      athletes: [
        {
          error: {
            code: "23505",
            message: 'duplicate key value violates unique constraint "athletes_org_email_unique"',
          },
        },
      ],
    }).client;
    expect(await createAthlete(form(MARIA))).toEqual({
      ok: false,
      message: "An athlete with this email already exists in your organization.",
      fieldErrors: { email: ["Already used by another athlete."] },
    });
  });

  it("puts a duplicate phone on the phone field", async () => {
    db.current = fakeSupabase({
      athletes: [
        {
          error: {
            code: "23505",
            message: 'duplicate key value violates unique constraint "athletes_org_phone_unique"',
          },
        },
      ],
    }).client;
    expect(await createAthlete(form({ ...MARIA, phone: "787-555-0101" }))).toEqual({
      ok: false,
      message: "An athlete with this phone number already exists in your organization.",
      fieldErrors: { phone: ["Already used by another athlete."] },
    });
  });

  it("adds an athlete", async () => {
    db.current = fakeSupabase({ athletes: [{ error: null }] }).client;
    expect(await createAthlete(form(MARIA))).toEqual({ ok: true });
  });
});

describe("deleteAthlete", () => {
  it("removes an athlete", async () => {
    db.current = fakeSupabase({ athletes: [{ data: [{ id: "a-1" }] }] }).client;
    expect(await deleteAthlete("a-1")).toEqual({ ok: true });
  });
});
