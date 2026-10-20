import { describe, expect, it } from "vitest";
import { compareDivisionNames, compareHeatsForRunningOrder } from "./divisionOrder";

describe("compareDivisionNames", () => {
  it("orders Scale before Rx, Male before Female within each", () => {
    const names = ["RX Female", "Scale Male", "RX Male", "Scale Female"];
    const sorted = [...names].sort(compareDivisionNames);
    expect(sorted).toEqual(["Scale Male", "Scale Female", "RX Male", "RX Female"]);
  });

  it("puts Beginner before Scale, in the same Male-then-Female order", () => {
    const names = ["Scale Female", "Beginner Female", "Scale Male", "Beginner Male"];
    const sorted = [...names].sort(compareDivisionNames);
    expect(sorted).toEqual(["Beginner Male", "Beginner Female", "Scale Male", "Scale Female"]);
  });

  it("matches 'Scaled' the same as 'Scale', case-insensitively", () => {
    const names = ["rx male", "SCALED FEMALE", "scale male"];
    const sorted = [...names].sort(compareDivisionNames);
    expect(sorted).toEqual(["scale male", "SCALED FEMALE", "rx male"]);
  });

  it("sorts an unrecognized division name after every known skill level", () => {
    const names = ["RX Male", "Masters", "Scale Female"];
    const sorted = [...names].sort(compareDivisionNames);
    expect(sorted).toEqual(["Scale Female", "RX Male", "Masters"]);
  });

  it("falls back to alphabetical order between two unrecognized names", () => {
    const names = ["Zeta", "Alpha"];
    const sorted = [...names].sort(compareDivisionNames);
    expect(sorted).toEqual(["Alpha", "Zeta"]);
  });
});

describe("compareHeatsForRunningOrder", () => {
  const FRAN = "2026-01-01T00:00:00.000Z"; // entered first
  const GRACE = "2026-01-02T00:00:00.000Z"; // entered second

  it("groups heats by division first, then orders by heat number within it, for a single WOD", () => {
    const heats = [
      { id: "rx-m-2", wodCreatedAt: FRAN, divisionName: "RX Male", heatNumber: 2 },
      { id: "scale-f-1", wodCreatedAt: FRAN, divisionName: "Scale Female", heatNumber: 1 },
      { id: "scale-m-2", wodCreatedAt: FRAN, divisionName: "Scale Male", heatNumber: 2 },
      { id: "rx-m-1", wodCreatedAt: FRAN, divisionName: "RX Male", heatNumber: 1 },
      { id: "scale-m-1", wodCreatedAt: FRAN, divisionName: "Scale Male", heatNumber: 1 },
      { id: "scale-f-2", wodCreatedAt: FRAN, divisionName: "Scale Female", heatNumber: 2 },
    ];
    const sorted = [...heats].sort(compareHeatsForRunningOrder);
    expect(sorted.map((h) => h.id)).toEqual([
      "scale-m-1",
      "scale-m-2",
      "scale-f-1",
      "scale-f-2",
      "rx-m-1",
      "rx-m-2",
    ]);
  });

  it("runs every heat of the first-entered WOD before any heat of a later one", () => {
    // Deliberately out of order and interleaved, as they might come back
    // from the database with no explicit ORDER BY.
    const heats = [
      { id: "grace-scale-m-1", wodCreatedAt: GRACE, divisionName: "Scale Male", heatNumber: 1 },
      { id: "fran-rx-f-1", wodCreatedAt: FRAN, divisionName: "RX Female", heatNumber: 1 },
      { id: "grace-rx-m-1", wodCreatedAt: GRACE, divisionName: "RX Male", heatNumber: 1 },
      { id: "fran-scale-m-1", wodCreatedAt: FRAN, divisionName: "Scale Male", heatNumber: 1 },
    ];
    const sorted = [...heats].sort(compareHeatsForRunningOrder);
    expect(sorted.map((h) => h.id)).toEqual([
      "fran-scale-m-1",
      "fran-rx-f-1",
      "grace-scale-m-1",
      "grace-rx-m-1",
    ]);
  });
});
