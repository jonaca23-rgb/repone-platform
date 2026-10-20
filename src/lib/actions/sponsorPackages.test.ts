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

import { createSponsorPackage, togglePackageActive, updateSponsorPackage } from "./sponsorPackages";

const DUPLICATE = "A package with that name already exists.";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}
const valid = {
  name: "Gold",
  display_enabled: "on",
  display_duration_seconds: "15",
  display_weight: "3",
};

beforeEach(() => vi.clearAllMocks());

describe("sponsor packages", () => {
  it("creates a package for the org", async () => {
    const fake = fakeSupabase({ sponsor_packages: [{ error: null }] });
    db.current = fake.client;
    expect(await createSponsorPackage(form(valid))).toEqual({ ok: true });
    expect(fake.calls).toContainEqual([
      "sponsor_packages",
      "insert",
      [
        {
          organization_id: "org-1",
          name: "Gold",
          display_enabled: true,
          display_duration_seconds: 15,
          display_weight: 3,
          sort_order: 0,
        },
      ],
    ]);
  });

  it("names a duplicate package on the name field", async () => {
    db.current = fakeSupabase({
      sponsor_packages: [
        {
          error: {
            message:
              'duplicate key value violates unique constraint "sponsor_packages_organization_id_name_key"',
          },
        },
      ],
    }).client;
    expect(await createSponsorPackage(form(valid))).toEqual({
      ok: false,
      message: DUPLICATE,
      fieldErrors: { name: [DUPLICATE] },
    });
  });

  it("refuses a display duration under 3 seconds", async () => {
    db.current = fakeSupabase({}).client;
    const result = await createSponsorPackage(form({ ...valid, display_duration_seconds: "2" }));
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: { display_duration_seconds: ["Display duration must be at least 3."] },
    });
  });

  it("updates a package of this org", async () => {
    const fake = fakeSupabase({ sponsor_packages: [{ data: [{ id: "p-1" }] }] });
    db.current = fake.client;
    expect(await updateSponsorPackage("p-1", form(valid))).toEqual({ ok: true });
    expect(fake.calls).toContainEqual(["sponsor_packages", "eq", ["organization_id", "org-1"]]);
  });

  it("switches a package off", async () => {
    db.current = fakeSupabase({ sponsor_packages: [{ data: [{ id: "p-1" }] }] }).client;
    expect(await togglePackageActive("p-1", false)).toEqual({ ok: true });
  });
});
