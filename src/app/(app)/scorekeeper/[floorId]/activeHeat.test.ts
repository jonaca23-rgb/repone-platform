import { describe, expect, it } from "vitest";
import { activeHeatId } from "./activeHeat";

const base = {
  following: true,
  manualHeatId: null,
  liveHeatId: "h-2",
  heldHeatId: null,
  firstHeatId: "h-1",
};

describe("activeHeatId", () => {
  it("follows the live heat", () => expect(activeHeatId(base)).toBe("h-2"));
  it("falls back to the first heat with nothing live", () =>
    expect(activeHeatId({ ...base, liveHeatId: null })).toBe("h-1"));
  it("stays on the picked heat when not following", () =>
    expect(activeHeatId({ ...base, following: false, manualHeatId: "h-5" })).toBe("h-5"));
  it("holds the open drawer's heat when production moves", () =>
    expect(activeHeatId({ ...base, liveHeatId: "h-3", heldHeatId: "h-2" })).toBe("h-2"));
  it("lands on the live heat once released", () =>
    expect(activeHeatId({ ...base, liveHeatId: "h-3", heldHeatId: null })).toBe("h-3"));
});
