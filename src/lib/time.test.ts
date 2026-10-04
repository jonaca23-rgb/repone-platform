import { describe, expect, it } from "vitest";
import { formatDateTime, formatDay, formatDayRange, formatTime } from "./time";

describe("time", () => {
  it("formats a calendar day without shifting it", () => {
    expect(formatDay("2026-10-04")).toBe("Oct 4, 2026");
  });

  it("formats ranges", () => {
    expect(formatDayRange(null, null)).toBe("Date TBD");
    expect(formatDayRange("2026-10-04", "2026-10-04")).toBe("Oct 4, 2026");
    expect(formatDayRange("2026-10-04", "2026-10-05")).toBe("Oct 4, 2026 — Oct 5, 2026");
  });

  it("shows instants in Puerto Rico time, across midnight UTC", () => {
    // 2026-10-05T02:30Z is 10:30 PM on Oct 4 in Puerto Rico (UTC-4).
    expect(formatDateTime("2026-10-05T02:30:00Z")).toBe("Oct 4, 2026, 10:30 PM");
    expect(formatTime("2026-10-05T02:30:00Z")).toBe("10:30 PM");
  });
});
