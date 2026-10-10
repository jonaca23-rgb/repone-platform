import { describe, expect, it } from "vitest";
import {
  currentAndNextHeat,
  eligibleInfoSlots,
  STALE_INFO_MS,
  type BlockSetting,
} from "./eligibility";

const heat = (
  id: string,
  wodCreatedAt: string,
  heatNumber: number,
  endedAt: string | null = null,
) => ({
  id,
  heatNumber,
  endedAt,
  wod: {
    id: `w-${wodCreatedAt}`,
    name: "WOD",
    description: null,
    scoring_type: "time",
    time_cap_seconds: null,
    created_at: wodCreatedAt,
  },
  division: { id: "d1", name: "Intermediate Female" },
});

describe("currentAndNextHeat", () => {
  const heats = [
    heat("w2h1", "2026-01-02", 1),
    heat("w1h2", "2026-01-01", 2, "x"),
    heat("w1h1", "2026-01-01", 1, "x"),
    heat("w1h3", "2026-01-01", 3),
  ];
  it("next is the first unfinished heat after the current one in running order", () => {
    const r = currentAndNextHeat(heats, "w1h2");
    expect(r.current?.id).toBe("w1h2");
    expect(r.next?.id).toBe("w1h3");
  });
  it("crosses into the next WOD", () => {
    expect(currentAndNextHeat(heats, "w1h3").next?.id).toBe("w2h1");
  });
  it("with no current heat, next is the first unfinished heat", () => {
    expect(currentAndNextHeat(heats, null)).toMatchObject({ current: null, next: { id: "w1h3" } });
  });
  it("after the last heat there is no next", () => {
    expect(currentAndNextHeat(heats, "w2h1").next).toBeNull();
  });
});

describe("eligibleInfoSlots", () => {
  const blocks: BlockSetting[] = [
    { type: "current_heat", enabled: true, durationSeconds: 15, weight: 2 },
    { type: "next_heat", enabled: true, durationSeconds: 12, weight: 1 },
    { type: "leaderboard", enabled: true, durationSeconds: 15, weight: 1 },
  ];
  const base = {
    blocks,
    current: { endedAt: null },
    next: {},
    leaderboardRows: 5,
    disconnectedSinceMs: null,
    nowMs: 1_000_000,
  };

  it("all three during an active heat with a next heat and standings", () => {
    expect(eligibleInfoSlots(base).map((s) => s.type)).toEqual([
      "current_heat",
      "next_heat",
      "leaderboard",
    ]);
  });
  it("between heats: an ended current heat is not shown", () => {
    expect(eligibleInfoSlots({ ...base, current: { endedAt: "x" } }).map((s) => s.type)).toEqual([
      "next_heat",
      "leaderboard",
    ]);
  });
  it("no standings, no leaderboard; disabled blocks are skipped", () => {
    const off = blocks.map((b) => (b.type === "next_heat" ? { ...b, enabled: false } : b));
    expect(
      eligibleInfoSlots({ ...base, blocks: off, leaderboardRows: 0 }).map((s) => s.type),
    ).toEqual(["current_heat"]);
  });
  it("keeps last-known info for 5 minutes offline, then suppresses it", () => {
    const at = base.nowMs - STALE_INFO_MS + 1;
    expect(eligibleInfoSlots({ ...base, disconnectedSinceMs: at })).toHaveLength(3);
    expect(eligibleInfoSlots({ ...base, disconnectedSinceMs: base.nowMs - STALE_INFO_MS })).toEqual(
      [],
    );
  });
});
