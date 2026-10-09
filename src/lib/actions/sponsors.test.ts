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
  createSponsor,
  toggleSponsorActive,
  updateSponsor,
  uploadSponsorCreative,
  uploadSponsorLogo,
} from "./sponsors";

const SPONSOR = "00000000-0000-4000-8000-000000000081";
const CREATIVE_TOO_BIG = "Creative must be under 4MB — export a 2160×3840 JPEG or WebP.";

function form(values: Record<string, string | File>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

function image(type: string, bytes: number) {
  return new File([new Uint8Array(bytes)], "x", { type });
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

  it("adds an org-level sponsor with its name, category, website and notes", async () => {
    const fake = fakeSupabase({ sponsors: [{ error: null }] });
    db.current = fake.client;
    const result = await createSponsor(
      form({
        business_name: "Hoka",
        category: "Shoes",
        website: "hoka.com",
        notes: "Pays in cash",
      }),
    );
    expect(result).toEqual({ ok: true });
    expect(fake.calls).toContainEqual([
      "sponsors",
      "insert",
      [
        {
          organization_id: "org-1",
          business_name: "Hoka",
          category: "Shoes",
          website: "hoka.com",
          notes: "Pays in cash",
        },
      ],
    ]);
  });
});

describe("updateSponsor", () => {
  it("edits a sponsor of this org", async () => {
    const fake = fakeSupabase({ sponsors: [{ data: [{ id: SPONSOR }] }] });
    db.current = fake.client;
    expect(await updateSponsor(SPONSOR, form({ business_name: "Hoka One" }))).toEqual({ ok: true });
    expect(fake.calls).toContainEqual(["sponsors", "eq", ["organization_id", "org-1"]]);
  });
});

describe("toggleSponsorActive", () => {
  it("switches a sponsor", async () => {
    db.current = fakeSupabase({ sponsors: [{ data: [{ id: "s-1" }] }] }).client;
    expect(await toggleSponsorActive("s-1", false)).toEqual({ ok: true });
  });
});

describe("uploads", () => {
  it("refuses a creative over 4MB with the export guidance", async () => {
    db.current = fakeSupabase({}).client;
    expect(
      await uploadSponsorCreative(SPONSOR, form({ creative: image("image/png", 5_000_000) })),
    ).toEqual({
      ok: false,
      message: CREATIVE_TOO_BIG,
      fieldErrors: { creative: [CREATIVE_TOO_BIG] },
    });
  });

  it("refuses a creative type the venue display can't show", async () => {
    db.current = fakeSupabase({}).client;
    const result = await uploadSponsorCreative(SPONSOR, form({ creative: image("image/gif", 10) }));
    expect(result).toMatchObject({
      ok: false,
      message: "Please upload a JPEG, PNG or WebP image.",
    });
  });

  it("refuses a logo for another organization's sponsor", async () => {
    db.current = fakeSupabase({ sponsors: [{ data: null }] }).client;
    const result = await uploadSponsorLogo(SPONSOR, form({ logo: image("image/png", 10) }));
    expect(result).toEqual({
      ok: false,
      message: "That sponsor doesn't belong to your organization.",
    });
  });
});
