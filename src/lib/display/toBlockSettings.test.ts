import { describe, expect, it } from "vitest";
import { toBlockSettings } from "./toBlockSettings";

describe("toBlockSettings", () => {
  it("orders the blocks current heat, next heat, leaderboard whatever the database returns", () => {
    expect(
      toBlockSettings([
        { block_type: "leaderboard", enabled: true, duration_seconds: 15, weight: 2 },
        { block_type: "current_heat", enabled: false, duration_seconds: 20, weight: 3 },
        { block_type: "next_heat", enabled: true, duration_seconds: 12, weight: 1 },
      ]),
    ).toEqual([
      { type: "current_heat", enabled: false, durationSeconds: 20, weight: 3 },
      { type: "next_heat", enabled: true, durationSeconds: 12, weight: 1 },
      { type: "leaderboard", enabled: true, durationSeconds: 15, weight: 2 },
    ]);
  });
});
