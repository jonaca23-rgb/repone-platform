import { describe, expect, it } from "vitest";
import { effectiveDisplay } from "./effective";

const pkg = { display_enabled: true, display_duration_seconds: 15, display_weight: 3 };

describe("effectiveDisplay", () => {
  it("uses the package defaults when there are no overrides", () => {
    expect(
      effectiveDisplay(pkg, { display_duration_override: null, display_weight_override: null }),
    ).toEqual({ enabled: true, durationSeconds: 15, weight: 3 });
  });
  it("lets the event sponsorship override duration and weight independently", () => {
    expect(
      effectiveDisplay(pkg, { display_duration_override: 20, display_weight_override: null }),
    ).toEqual({ enabled: true, durationSeconds: 20, weight: 3 });
    expect(
      effectiveDisplay(pkg, { display_duration_override: null, display_weight_override: 1 }),
    ).toEqual({ enabled: true, durationSeconds: 15, weight: 1 });
  });
  it("a package without the venue display entitlement is disabled", () => {
    expect(
      effectiveDisplay(
        { ...pkg, display_enabled: false },
        { display_duration_override: 20, display_weight_override: 4 },
      ).enabled,
    ).toBe(false);
  });
});
