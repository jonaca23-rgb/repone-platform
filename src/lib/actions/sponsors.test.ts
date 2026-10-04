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

import { createSponsor, toggleSponsorActive } from "./sponsors";

const EVENT = "00000000-0000-4000-8000-000000000010";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

beforeEach(() => vi.clearAllMocks());

describe("createSponsor", () => {
  it("reports a missing name on its field", async () => {
    db.current = fakeSupabase({}).client;
    expect(await createSponsor(form({ business_name: "" }))).toEqual({
      ok: false,
      message: "Business name is required.",
      fieldErrors: { business_name: ["Business name is required."] },
    });
  });

  it("reports an exclusive category already held", async () => {
    db.current = fakeSupabase({
      events: [{ data: { id: EVENT } }],
      sponsors: [
        {
          error: {
            message:
              'duplicate key value violates unique constraint "sponsors_category_exclusive_uidx"',
          },
        },
      ],
    }).client;
    expect(
      await createSponsor(
        form({
          business_name: "Hoka",
          category: "Shoes",
          category_exclusive: "on",
          event_id: EVENT,
        }),
      ),
    ).toEqual({
      ok: false,
      message: 'Another active sponsor already holds exclusive category "Shoes" for this event.',
    });
  });

  it("refuses another organization's event", async () => {
    db.current = fakeSupabase({ events: [{ data: null }] }).client;
    const result = await createSponsor(form({ business_name: "Hoka", event_id: EVENT }));
    expect(result).toMatchObject({
      ok: false,
      message: "That event doesn't belong to your organization.",
    });
  });

  it("adds a sponsor", async () => {
    db.current = fakeSupabase({ sponsors: [{ error: null }] }).client;
    expect(await createSponsor(form({ business_name: "Hoka" }))).toEqual({ ok: true });
  });
});

describe("toggleSponsorActive", () => {
  it("reports the exclusive-category clash", async () => {
    db.current = fakeSupabase({
      sponsors: [{ error: { message: "sponsors_category_exclusive_uidx" } }],
    }).client;
    expect(await toggleSponsorActive("s-1", true)).toEqual({
      ok: false,
      message: "Another active sponsor already holds this sponsor's exclusive category.",
    });
  });

  it("switches a sponsor", async () => {
    db.current = fakeSupabase({ sponsors: [{ data: [{ id: "s-1" }] }] }).client;
    expect(await toggleSponsorActive("s-1", false)).toEqual({ ok: true });
  });
});
