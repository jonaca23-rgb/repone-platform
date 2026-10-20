import { describe, expect, it } from "vitest";
import { scoringLabel } from "@/lib/scoring/format";
import { SCORING_TYPES } from "./wodOptions";

describe("SCORING_TYPES", () => {
  it("reads like every other screen, with Tabata's scoring spelled out in the form", () => {
    expect(SCORING_TYPES).toEqual([
      ["for_time", scoringLabel("for_time")],
      ["amrap", scoringLabel("amrap")],
      ["tabata", "Tabata (total reps)"],
      ["max_load", scoringLabel("max_load")],
      ["points", scoringLabel("points")],
      ["other", scoringLabel("other")],
    ]);
  });
});
