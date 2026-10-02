import { describe, expect, it } from "vitest";
import { formatResult } from "./formatResult";

const base = {
  time_seconds: null,
  reps: null,
  load: null,
  points: null,
  capped: false,
  status: "completed" as const,
};

describe("formatResult", () => {
  it("for_time shows the clock, or CAP+reps when capped", () => {
    expect(formatResult({ ...base, time_seconds: 225 }, "for_time")).toBe("03:45");
    expect(formatResult({ ...base, capped: true, reps: 12 }, "for_time")).toBe("CAP+12");
    expect(formatResult({ ...base, capped: true }, "for_time")).toBe("CAP");
  });

  it("amrap, max_load and points show their unit", () => {
    expect(formatResult({ ...base, reps: 87 }, "amrap")).toBe("87 reps");
    expect(formatResult({ ...base, load: 185.5 }, "max_load")).toBe("185.5 lb");
    expect(formatResult({ ...base, points: 40 }, "points")).toBe("40 pts");
    expect(formatResult({ ...base, points: 7 }, "other")).toBe("7 pts");
  });

  it("a non-completed status wins over any value", () => {
    expect(formatResult({ ...base, status: "dns", time_seconds: 200 }, "for_time")).toBe("DNS");
    expect(formatResult({ ...base, status: "dnf" }, "amrap")).toBe("DNF");
    expect(formatResult({ ...base, status: "dq" }, "points")).toBe("DQ");
  });

  it("no result or an empty value shows a dash", () => {
    expect(formatResult(null, "for_time")).toBe("—");
    expect(formatResult(base, "amrap")).toBe("—");
  });
});
