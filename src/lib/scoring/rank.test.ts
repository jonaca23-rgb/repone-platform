import { describe, expect, it } from "vitest";
import { rankWodResults } from "./rank";
import { computeOverallStandings } from "./standings";
import type { RawResult, WodScoringConfig } from "./types";

const forTime: WodScoringConfig = {
  id: "wod-1",
  scoringType: "for_time",
  timeCapSeconds: 900,
  tiebreakType: "time",
  lowerIsBetter: true,
};

const amrap: WodScoringConfig = {
  id: "wod-2",
  scoringType: "amrap",
  timeCapSeconds: 720,
  tiebreakType: "time",
  lowerIsBetter: false,
};

const maxLoad: WodScoringConfig = {
  id: "wod-3",
  scoringType: "max_load",
  timeCapSeconds: null,
  tiebreakType: "none",
  lowerIsBetter: false,
};

describe("rankWodResults — for_time", () => {
  it("ranks finishers fastest-first, ahead of any capped result", () => {
    const results: RawResult[] = [
      { competitorId: "a", timeSeconds: 420, capped: false },
      { competitorId: "b", timeSeconds: 380, capped: false },
      { competitorId: "c", reps: 140, capped: true },
    ];
    const ranked = rankWodResults(results, forTime);
    expect(ranked.find((r) => r.competitorId === "b")!.placement).toBe(1);
    expect(ranked.find((r) => r.competitorId === "a")!.placement).toBe(2);
    expect(ranked.find((r) => r.competitorId === "c")!.placement).toBe(3);
  });

  it("breaks ties on tiebreakValue, then shares placement if still tied", () => {
    const results: RawResult[] = [
      { competitorId: "a", timeSeconds: 300, tiebreakValue: 250 },
      { competitorId: "b", timeSeconds: 300, tiebreakValue: 240 },
      { competitorId: "c", timeSeconds: 300, tiebreakValue: 240 },
    ];
    const ranked = rankWodResults(results, forTime);
    expect(ranked.find((r) => r.competitorId === "b")!.placement).toBe(1);
    expect(ranked.find((r) => r.competitorId === "c")!.placement).toBe(1);
    // standard competition ranking: two tied for 1st, next is 3rd (not 2nd)
    expect(ranked.find((r) => r.competitorId === "a")!.placement).toBe(3);
  });

  it("ranks capped results among themselves by reps completed, more reps wins", () => {
    const results: RawResult[] = [
      { competitorId: "a", reps: 120, capped: true },
      { competitorId: "b", reps: 150, capped: true },
    ];
    const ranked = rankWodResults(results, forTime);
    expect(ranked.find((r) => r.competitorId === "b")!.placement).toBe(1);
    expect(ranked.find((r) => r.competitorId === "a")!.placement).toBe(2);
  });

  it("always ranks dns/dnf/dq after every completed result, with no placement", () => {
    const results: RawResult[] = [
      { competitorId: "a", timeSeconds: 500 },
      { competitorId: "b", status: "dnf" },
      { competitorId: "c", status: "dns" },
    ];
    const ranked = rankWodResults(results, forTime);
    expect(ranked.find((r) => r.competitorId === "a")!.placement).toBe(1);
    expect(ranked.find((r) => r.competitorId === "b")!.placement).toBeNull();
    expect(ranked.find((r) => r.competitorId === "c")!.placement).toBeNull();
    expect(ranked.find((r) => r.competitorId === "b")!.wodPoints).toBeNull();
  });
});

describe("rankWodResults — amrap", () => {
  it("ranks by reps descending", () => {
    const results: RawResult[] = [
      { competitorId: "a", reps: 210 },
      { competitorId: "b", reps: 245 },
      { competitorId: "c", reps: 190 },
    ];
    const ranked = rankWodResults(results, amrap);
    expect(ranked.find((r) => r.competitorId === "b")!.placement).toBe(1);
    expect(ranked.find((r) => r.competitorId === "a")!.placement).toBe(2);
    expect(ranked.find((r) => r.competitorId === "c")!.placement).toBe(3);
  });
});

describe("rankWodResults — max_load", () => {
  it("ranks by load descending", () => {
    const results: RawResult[] = [
      { competitorId: "a", load: 225 },
      { competitorId: "b", load: 255 },
    ];
    const ranked = rankWodResults(results, maxLoad);
    expect(ranked.find((r) => r.competitorId === "b")!.placement).toBe(1);
  });
});

describe("computeOverallStandings", () => {
  it("sums placement-points across WODs, lowest total wins", () => {
    const wod1 = rankWodResults(
      [
        { competitorId: "a", timeSeconds: 300 },
        { competitorId: "b", timeSeconds: 320 },
      ],
      forTime
    );
    const wod2 = rankWodResults(
      [
        { competitorId: "a", reps: 180 },
        { competitorId: "b", reps: 220 },
      ],
      amrap
    );
    const standings = computeOverallStandings([
      { wodId: "wod-1", results: wod1 },
      { wodId: "wod-2", results: wod2 },
    ]);
    // a: 1st + 2nd = 3 points; b: 2nd + 1st = 3 points -> tied for 1st overall
    const a = standings.find((s) => s.competitorId === "a")!;
    const b = standings.find((s) => s.competitorId === "b")!;
    expect(a.totalPoints).toBe(3);
    expect(b.totalPoints).toBe(3);
    expect(a.overallPlacement).toBe(1);
    expect(b.overallPlacement).toBe(1);
  });
});
