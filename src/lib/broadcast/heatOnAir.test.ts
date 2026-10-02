import { describe, expect, it } from "vitest";
import { heatOnAir } from "./heatOnAir";

const heats = [{ id: "h1" }, { id: "h2" }, { id: "h3" }];

describe("heatOnAir", () => {
  it("shows the heat broadcast_state has on air", () => {
    expect(heatOnAir(heats, "h2")).toEqual({ index: 1, onAir: true });
  });

  it("with nothing on air, shows the first heat but says it is not on air", () => {
    expect(heatOnAir(heats, null)).toEqual({ index: 0, onAir: false });
  });

  it("a single-heat floor with nothing on air can still be put on air", () => {
    expect(heatOnAir([{ id: "only" }], null)).toEqual({ index: 0, onAir: false });
  });

  it("an on-air heat that is no longer on this floor counts as nothing on air", () => {
    expect(heatOnAir(heats, "deleted")).toEqual({ index: 0, onAir: false });
  });

  it("no heats: nothing to show", () => {
    expect(heatOnAir([], null)).toEqual({ index: -1, onAir: false });
  });
});
