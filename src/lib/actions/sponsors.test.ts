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

  it("explains a category held exclusively at one of the sponsor's events", async () => {
    db.current = fakeSupabase({
      sponsors: [
        { error: { message: 'sponsor_category_exclusive: category "apparel" is exclusive' } },
      ],
    }).client;
    expect(
      await updateSponsor(SPONSOR, form({ business_name: "Hoka", category: "Apparel" })),
    ).toEqual({
      ok: false,
      message:
        "Another sponsor holds that category exclusively at an event this sponsor is part of.",
      fieldErrors: {
        category: [
          "Another sponsor holds that category exclusively at an event this sponsor is part of.",
        ],
      },
    });
  });
});

describe("toggleSponsorActive", () => {
  it("switches a sponsor", async () => {
    db.current = fakeSupabase({ sponsors: [{ data: [{ id: "s-1" }] }] }).client;
    expect(await toggleSponsorActive("s-1", false)).toEqual({ ok: true });
  });

  it("explains why switching a sponsor back on is refused", async () => {
    db.current = fakeSupabase({
      sponsors: [
        { error: { message: 'sponsor_category_exclusive: category "apparel" is exclusive' } },
      ],
    }).client;
    expect(await toggleSponsorActive("s-1", true)).toEqual({
      ok: false,
      message:
        "Another sponsor holds this sponsor's category exclusively at one of its events. Switch that one off there first.",
    });
  });
});

/** A fake client whose storage records uploads and removals. */
function withStorage(responses: Parameters<typeof fakeSupabase>[0]) {
  const fake = fakeSupabase(responses);
  const remove = vi.fn(async () => ({ data: [], error: null }));
  const bucket = {
    upload: vi.fn(async () => ({ data: {}, error: null })),
    getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn/${path}` } }),
    remove,
  };
  return { client: { ...fake.client, storage: { from: () => bucket } }, remove };
}

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

  it("removes the uploaded logo when saving it on the sponsor fails", async () => {
    const { client, remove } = withStorage({
      sponsors: [{ data: { id: SPONSOR } }, { error: { message: "connection reset" } }],
    });
    db.current = client;
    await expect(
      uploadSponsorLogo(SPONSOR, form({ logo: image("image/png", 10) })),
    ).rejects.toThrow();
    expect(remove).toHaveBeenCalledWith([expect.stringMatching(`^${SPONSOR}/logo-`)]);
  });

  it("removes the uploaded creative when recording it fails", async () => {
    const { client, remove } = withStorage({
      sponsors: [{ data: { id: SPONSOR } }],
      sponsor_creatives: [{ error: { message: "connection reset" } }],
    });
    db.current = client;
    await expect(
      uploadSponsorCreative(SPONSOR, form({ creative: image("image/png", 10) })),
    ).rejects.toThrow();
    expect(remove).toHaveBeenCalledWith([expect.stringMatching(`^${SPONSOR}/`)]);
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
