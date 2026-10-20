import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ createClient: async () => null }));

import { type RawSponsorshipRow, toBroadcastSponsor, toEventSponsor } from "./sponsors";

const pkg = {
  id: "p-1",
  name: "WOD Sponsor",
  display_enabled: true,
  display_duration_seconds: 15,
  display_weight: 3,
};

function row(overrides: Partial<RawSponsorshipRow> = {}): RawSponsorshipRow {
  return {
    id: "es-1",
    display_duration_override: null,
    display_weight_override: null,
    sponsors: {
      id: "s-1",
      business_name: "Borinquen Nutrition",
      logo_url: null,
      active: true,
      sponsor_creatives: [
        { id: "c-old", public_url: "old.png", active: true, created_at: "2026-10-01T00:00:00Z" },
        { id: "c-off", public_url: "off.png", active: false, created_at: "2026-10-03T00:00:00Z" },
        { id: "c-new", public_url: "new.png", active: true, created_at: "2026-10-02T00:00:00Z" },
      ],
    },
    sponsor_packages: pkg,
    ...overrides,
  };
}

describe("toEventSponsor", () => {
  it("drops an inactive sponsor and a sponsorship without a package", () => {
    expect(toEventSponsor(row({ sponsors: { ...row().sponsors!, active: false } }))).toBeNull();
    expect(toEventSponsor(row({ sponsor_packages: null }))).toBeNull();
  });

  it("lists active creatives newest first", () => {
    expect(toEventSponsor(row())?.creatives).toEqual([
      { id: "c-new", url: "new.png" },
      { id: "c-old", url: "old.png" },
    ]);
  });

  it("applies the sponsorship's overrides over the package", () => {
    const s = toEventSponsor(row({ display_weight_override: 1 }));
    expect(s).toMatchObject({
      sponsorshipId: "es-1",
      sponsorId: "s-1",
      packageName: "WOD Sponsor",
      display: { enabled: true, durationSeconds: 15, weight: 1 },
    });
  });

  it("gives broadcast surfaces the sponsor's id, name, logo and package", () => {
    const s = toEventSponsor(row());
    expect(s && toBroadcastSponsor(s)).toEqual({
      id: "s-1",
      business_name: "Borinquen Nutrition",
      logo_url: null,
      packageName: "WOD Sponsor",
    });
  });
});
