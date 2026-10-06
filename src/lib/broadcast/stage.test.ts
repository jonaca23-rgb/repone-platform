import { describe, expect, it } from "vitest";
import { stageOffset, stageScale } from "./stage";

describe("stageScale", () => {
  it.each([
    [1920, 1080, 1],
    [1280, 720, 2 / 3],
    [3840, 2160, 2],
    [1080, 1920, 0.5625],
  ])("%ix%i scales by %f", (w, h, s) => expect(stageScale(w, h)).toBeCloseTo(s));
});

describe("stageOffset", () => {
  it("centres a letterboxed stage", () => {
    expect(stageOffset(1080, 1920)).toEqual({ x: 0, y: (1920 - 1080 * 0.5625) / 2 });
  });
  it("is zero when the viewport matches", () =>
    expect(stageOffset(1280, 720)).toEqual({ x: 0, y: 0 }));
});
