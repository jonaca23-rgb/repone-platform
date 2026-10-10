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

import {
  addEventSponsorship,
  toggleEventSponsorshipActive,
  updateEventSponsorship,
} from "./eventSponsorships";

const EVENT = "00000000-0000-4000-8000-000000000010";
const SPONSOR = "00000000-0000-4000-8000-000000000081";
const PACKAGE = "00000000-0000-4000-8000-000000000091";
const OWN_EVENT = { events: [{ data: { id: EVENT } }] };

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

beforeEach(() => vi.clearAllMocks());

describe("addEventSponsorship", () => {
  it("refuses another organization's event", async () => {
    db.current = fakeSupabase({ events: [{ data: null }] }).client;
    expect(
      await addEventSponsorship(EVENT, form({ sponsor_id: SPONSOR, package_id: PACKAGE })),
    ).toEqual({ ok: false, message: "That event doesn't belong to your organization." });
  });

  it("explains an exclusive category already held", async () => {
    db.current = fakeSupabase({
      ...OWN_EVENT,
      event_sponsorships: [
        {
          error: {
            message: 'sponsor_category_exclusive: category "nutrition" is exclusive for this event',
          },
        },
      ],
    }).client;
    expect(
      await addEventSponsorship(EVENT, form({ sponsor_id: SPONSOR, package_id: PACKAGE })),
    ).toEqual({
      ok: false,
      message: "Another active sponsor holds this category exclusively at this event.",
    });
  });

  it("explains a sponsor already at the event", async () => {
    db.current = fakeSupabase({
      ...OWN_EVENT,
      event_sponsorships: [
        {
          error: {
            message:
              'duplicate key value violates unique constraint "event_sponsorships_event_id_sponsor_id_key"',
          },
        },
      ],
    }).client;
    expect(
      await addEventSponsorship(EVENT, form({ sponsor_id: SPONSOR, package_id: PACKAGE })),
    ).toMatchObject({ ok: false, message: "That sponsor is already part of this event." });
  });

  it("adds a sponsor to the event", async () => {
    const fake = fakeSupabase({ ...OWN_EVENT, event_sponsorships: [{ error: null }] });
    db.current = fake.client;
    expect(
      await addEventSponsorship(
        EVENT,
        form({ sponsor_id: SPONSOR, package_id: PACKAGE, category_exclusive: "on" }),
      ),
    ).toEqual({ ok: true });
    expect(fake.calls).toContainEqual([
      "event_sponsorships",
      "insert",
      [{ event_id: EVENT, sponsor_id: SPONSOR, package_id: PACKAGE, category_exclusive: true }],
    ]);
  });
});

describe("updateEventSponsorship", () => {
  it("stores blank overrides as null so the package defaults apply", async () => {
    const fake = fakeSupabase({ ...OWN_EVENT, event_sponsorships: [{ data: [{ id: "es-1" }] }] });
    db.current = fake.client;
    const result = await updateEventSponsorship(
      EVENT,
      "es-1",
      form({ package_id: PACKAGE, display_duration_override: "", display_weight_override: " " }),
    );
    expect(result).toEqual({ ok: true });
    expect(fake.calls).toContainEqual([
      "event_sponsorships",
      "update",
      [
        {
          package_id: PACKAGE,
          category_exclusive: false,
          display_duration_override: null,
          display_weight_override: null,
        },
      ],
    ]);
  });

  it("refuses a fractional weight override", async () => {
    db.current = fakeSupabase(OWN_EVENT).client;
    const result = await updateEventSponsorship(
      EVENT,
      "es-1",
      form({ package_id: PACKAGE, display_weight_override: "2.5" }),
    );
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: { display_weight_override: expect.any(Array) },
    });
  });
});

describe("toggleEventSponsorshipActive", () => {
  it("explains an exclusive clash on re-activation", async () => {
    db.current = fakeSupabase({
      ...OWN_EVENT,
      event_sponsorships: [{ error: { message: "sponsor_category_exclusive: …" } }],
    }).client;
    expect(await toggleEventSponsorshipActive(EVENT, "es-1", true)).toEqual({
      ok: false,
      message: "Another active sponsor holds this category exclusively at this event.",
    });
  });
});
