import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio, rootTokens } from "./contrast";

const tokens = rootTokens(readFileSync("src/app/globals.css", "utf8"));

describe("contrastRatio", () => {
  it("matches WCAG reference values", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 0);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 1);
  });
});

describe("theme tokens meet WCAG AA", () => {
  const text: Array<[string, string]> = [
    ["--foreground", "--background"],
    ["--foreground", "--card"],
    ["--muted-foreground", "--background"],
    ["--muted-foreground", "--card"],
    ["--muted-foreground", "--muted"],
    ["--brand-text", "--background"],
    ["--brand-text", "--card"],
    ["--primary-foreground", "--primary"],
    ["--primary-foreground", "--destructive-fill"],
    ["--destructive", "--card"],
    ["--success-text", "--card"],
    ["--warning-text", "--card"],
  ];
  it.each(text)("%s on %s is at least 4.5:1", (fg, bg) => {
    expect(contrastRatio(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(4.5);
  });
  it("the focus ring is at least 3:1 against the page", () => {
    expect(contrastRatio(tokens["--ring"], tokens["--background"])).toBeGreaterThanOrEqual(3);
  });
});
