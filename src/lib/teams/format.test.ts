import { describe, expect, it } from "vitest";
import { formatLabel, isTeamFormat } from "./format";

describe("formatLabel", () => {
  it.each([
    ["individual", null, "Individual"],
    ["pair", 2, "Pairs"],
    ["team", 4, "Teams of 4"],
    ["custom", 3, "Teams of 3"],
    ["team", null, "Teams"],
  ] as const)("%s (%s) reads %s", (format, size, label) =>
    expect(formatLabel(format, size)).toBe(label),
  );
});

describe("isTeamFormat", () => {
  it("is false only for individual", () => {
    expect(isTeamFormat("individual")).toBe(false);
    expect(isTeamFormat("pair")).toBe(true);
    expect(isTeamFormat("team")).toBe(true);
  });
});
