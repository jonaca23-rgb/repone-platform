import { describe, expect, it } from "vitest";
import {
  joinClock,
  type LaneResult,
  scoreSummary,
  scoringLabel,
  splitClock,
  wodSummary,
} from "./format";

const base: LaneResult = {
  athlete_id: "a",
  time_seconds: null,
  reps: null,
  load: null,
  points: null,
  capped: false,
  status: "completed",
  tiebreak_value: null,
  manually_adjusted: false,
};

describe("splitClock", () => {
  it("splits whole seconds", () =>
    expect(splitClock(225)).toEqual({ minutes: "3", seconds: "45" }));
  it("pads seconds", () => expect(splitClock(63)).toEqual({ minutes: "1", seconds: "03" }));
  it("keeps a decimal", () => expect(splitClock(225.5)).toEqual({ minutes: "3", seconds: "45.5" }));
  it("pads before a decimal", () =>
    expect(splitClock(65.5)).toEqual({ minutes: "1", seconds: "05.5" }));
  it("is blank for null", () => expect(splitClock(null)).toEqual({ minutes: "", seconds: "" }));
});

describe("joinClock", () => {
  it("joins", () => expect(joinClock("3", "45")).toBe("3:45"));
  it("fills blank minutes", () => expect(joinClock("", "45")).toBe("0:45"));
  it("fills blank seconds", () => expect(joinClock("3", "")).toBe("3:00"));
  it("is blank when both are blank", () => expect(joinClock(" ", "")).toBe(""));
  it("pads one-digit seconds", () => expect(joinClock("3", "7")).toBe("3:07"));
  it("passes junk through for the server to reject", () =>
    expect(joinClock("3", "7x")).toBe("3:7x"));
});

describe("scoreSummary", () => {
  it("is a dash with no result", () => expect(scoreSummary(undefined, "for_time")).toBe("—"));
  it("shows DNF", () => expect(scoreSummary({ ...base, status: "dnf" }, "amrap")).toBe("DNF"));
  it("shows DNS", () => expect(scoreSummary({ ...base, status: "dns" }, "amrap")).toBe("DNS"));
  it("shows DQ", () => expect(scoreSummary({ ...base, status: "dq" }, "amrap")).toBe("DQ"));
  it("shows a time", () =>
    expect(scoreSummary({ ...base, time_seconds: 252 }, "for_time")).toBe("04:12"));
  it("shows a cap with reps", () =>
    expect(scoreSummary({ ...base, capped: true, reps: 87 }, "for_time")).toBe("CAP 87"));
  it("shows a cap without reps", () =>
    expect(scoreSummary({ ...base, capped: true }, "for_time")).toBe("CAP"));
  it("shows reps", () => expect(scoreSummary({ ...base, reps: 87 }, "amrap")).toBe("87 reps"));
  it("shows load", () => expect(scoreSummary({ ...base, load: 120 }, "max_load")).toBe("120"));
  it("shows points", () => expect(scoreSummary({ ...base, points: 42 }, "points")).toBe("42 pts"));
  it("shows points for other", () =>
    expect(scoreSummary({ ...base, points: 7 }, "other")).toBe("7 pts"));
  it("is a dash for a completed result with no number", () =>
    expect(scoreSummary(base, "amrap")).toBe("—"));
});

describe("scoringLabel", () => {
  it.each([
    ["for_time", "For time"],
    ["amrap", "AMRAP"],
    ["max_load", "Max load"],
    ["points", "Points"],
    ["other", "Other"],
    ["tie_break_only", "tie break only"],
  ])("%s reads %s", (type, label) => expect(scoringLabel(type)).toBe(label));
});

describe("wodSummary", () => {
  it("names the cap in minutes", () =>
    expect(wodSummary({ name: "WOD 2", scoring_type: "for_time", time_cap_seconds: 900 })).toBe(
      "WOD 2 · For time · 15 min cap",
    ));
  it("leaves out a missing cap", () =>
    expect(wodSummary({ name: "WOD 1", scoring_type: "max_load", time_cap_seconds: null })).toBe(
      "WOD 1 · Max load",
    ));
});
