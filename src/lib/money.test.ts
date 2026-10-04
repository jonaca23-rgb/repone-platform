import { describe, expect, it } from "vitest";
import { formatCents } from "./money";

describe("formatCents", () => {
  it("shows dollars with cents", () => {
    expect(formatCents(7500)).toBe("$75.00");
    expect(formatCents(5)).toBe("$0.05");
    expect(formatCents(0)).toBe("$0.00");
  });
  it("groups thousands", () => {
    expect(formatCents(123456789)).toBe("$1,234,567.89");
  });
});
