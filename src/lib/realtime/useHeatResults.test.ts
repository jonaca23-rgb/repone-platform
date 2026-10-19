import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/client", () => ({ createClient: () => null }));

import { heatResultsByCompetitor } from "./useHeatResults";

const result = {
  time_seconds: 300,
  reps: null,
  load: null,
  points: null,
  capped: false,
  status: "completed" as const,
};

describe("heatResultsByCompetitor", () => {
  it("keys athletes' and teams' results by their id, with their place", () => {
    const map = heatResultsByCompetitor(
      [
        { ...result, athlete_id: "a-1", team_id: null },
        { ...result, athlete_id: null, team_id: "t-1", time_seconds: 280 },
      ],
      [
        { athlete_id: null, team_id: "t-1", placement: 1 },
        { athlete_id: "a-1", team_id: null, placement: 2 },
      ],
    );
    expect(map.get("t-1")).toEqual({ result: { ...result, time_seconds: 280 }, placement: 1 });
    expect(map.get("a-1")?.placement).toBe(2);
  });
});
