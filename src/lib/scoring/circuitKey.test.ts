import { describe, expect, it } from "vitest";
import { circuitCompetitorKey } from "./circuitKey";

describe("circuitCompetitorKey", () => {
  it("is the athlete's id for an athlete", () =>
    expect(circuitCompetitorKey({ athleteId: "a-1", teamId: null, teamName: null })).toBe("a-1"));

  it("is the team's name for a team, so the same team at two stops adds up", () => {
    const stop1 = circuitCompetitorKey({ athleteId: null, teamId: "t-1", teamName: "Aprieta Duo" });
    const stop2 = circuitCompetitorKey({
      athleteId: null,
      teamId: "t-9",
      teamName: " aprieta  duo ",
    });
    expect(stop1).toBe("team:aprieta duo");
    expect(stop2).toBe(stop1);
  });

  it("falls back to the team's id when its name is unknown", () =>
    expect(circuitCompetitorKey({ athleteId: null, teamId: "t-1", teamName: null })).toBe("t-1"));

  it("is null for a row with no competitor", () =>
    expect(circuitCompetitorKey({ athleteId: null, teamId: null, teamName: null })).toBeNull());
});
