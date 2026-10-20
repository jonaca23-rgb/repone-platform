import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/lib/actions/testing/fakeSupabase";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.current }));
vi.mock("@/lib/db/queries", () => ({
  getFloorContext: async () => ({ eventId: "ev-1", eventName: "Aprieta", heats: [] }),
}));
const sponsor = (id: string, enabled: boolean) => ({
  sponsorshipId: `es-${id}`,
  sponsorId: id,
  businessName: id,
  logoUrl: null,
  packageId: "p",
  packageName: "Logo Sponsor",
  display: { enabled, durationSeconds: 10, weight: 1 },
  creatives: [],
});
vi.mock("@/lib/db/sponsors", () => ({
  getEventSponsors: async () => [sponsor("on", true), sponsor("off", false)],
}));

import { loadDisplaySnapshot } from "./snapshot";

const device = {
  id: "d-1",
  event_id: "ev-1",
  floor_id: "f-1",
  name: "Entrance",
  enabled: true,
  sponsors_enabled: true,
  info_blocks_between_sponsors: 1,
  display_blocks: [{ block_type: "leaderboard", enabled: true, duration_seconds: 15, weight: 2 }],
};

beforeEach(() => vi.clearAllMocks());

describe("loadDisplaySnapshot", () => {
  it("is null for a display that doesn't exist", async () => {
    db.current = fakeSupabase({ display_devices: [{ data: null }] }).client;
    expect(await loadDisplaySnapshot("ev-1", "d-1")).toBeNull();
  });

  it("is null when the URL names another event", async () => {
    db.current = fakeSupabase({ display_devices: [{ data: device }] }).client;
    expect(await loadDisplaySnapshot("ev-2", "d-1")).toBeNull();
  });

  it("keeps only sponsors whose package shows on the venue display", async () => {
    db.current = fakeSupabase({ display_devices: [{ data: device }] }).client;
    const snap = await loadDisplaySnapshot("ev-1", "d-1");
    expect(snap?.sponsors.map((s) => s.sponsorId)).toEqual(["on"]);
    expect(snap?.device).toEqual({
      id: "d-1",
      eventId: "ev-1",
      floorId: "f-1",
      name: "Entrance",
      enabled: true,
      sponsorsEnabled: true,
      infoBlocksBetweenSponsors: 1,
    });
    expect(snap?.blocks).toEqual([
      { type: "leaderboard", enabled: true, durationSeconds: 15, weight: 2 },
    ]);
    expect(snap?.eventName).toBe("Aprieta");
  });
});
