import { describe, expect, it } from "vitest";
import { computeAgeCategory } from "./ageCategory";

describe("computeAgeCategory", () => {
  it("returns null when under 35 as of the reference date", () => {
    expect(computeAgeCategory("2000-01-01", "male", "2026-06-01")).toBeNull();
  });

  it("classifies 35-44 correctly, gender-specific", () => {
    expect(computeAgeCategory("1990-06-15", "male", "2026-06-15")).toBe("35_44_male");
    expect(computeAgeCategory("1990-06-15", "female", "2026-06-15")).toBe("35_44_female");
  });

  it("uses the reference date's exact day for the birthday cutoff", () => {
    // Turns 35 on 2026-06-15.
    expect(computeAgeCategory("1991-06-15", "male", "2026-06-14")).toBeNull(); // still 34
    expect(computeAgeCategory("1991-06-15", "male", "2026-06-15")).toBe("35_44_male"); // turns 35 today
  });

  it("classifies 45+ correctly, gender-specific", () => {
    expect(computeAgeCategory("1980-01-01", "male", "2026-06-01")).toBe("45_plus_male");
    expect(computeAgeCategory("1980-01-01", "female", "2026-06-01")).toBe("45_plus_female");
  });

  it("returns null when gender or date of birth is missing", () => {
    expect(computeAgeCategory(null, "male", "2026-06-01")).toBeNull();
    expect(computeAgeCategory("1980-01-01", null, "2026-06-01")).toBeNull();
  });

  it("accepts a Date object as the reference date", () => {
    expect(computeAgeCategory("1980-01-01", "male", new Date(2026, 5, 1))).toBe("45_plus_male");
  });
});
