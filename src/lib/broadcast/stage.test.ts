import { describe, expect, it } from "vitest";
import { DISPLAY_STAGE, fitStage, stageOffset, stageScale } from "./stage";

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

describe("fitStage", () => {
  it("scales the portrait display stage to a 4K portrait screen", () =>
    expect(fitStage(DISPLAY_STAGE, 2160, 3840)).toEqual({ s: 2, x: 0, y: 0 }));
  it("is 1:1 at its own size", () =>
    expect(fitStage(DISPLAY_STAGE, 1080, 1920)).toEqual({ s: 1, x: 0, y: 0 }));
  it("centres a portrait stage in a landscape viewport", () => {
    const fit = fitStage(DISPLAY_STAGE, 1920, 1080);
    expect(fit.s).toBeCloseTo(0.5625);
    expect(fit.x).toBeCloseTo((1920 - 1080 * 0.5625) / 2);
    expect(fit.y).toBe(0);
  });
});
