import { describe, expect, it } from "vitest";
import { needsHeatSwitchConfirm, needsRestartConfirm, onAirSummary } from "./onAir";

const HEATS = [
  {
    id: "h-6",
    heatNumber: 6,
    heatCount: 9,
    wod: { name: "WOD 2" },
    division: { name: "Intermediate Female" },
    lanes: [{ athleteId: "a-1", name: "Maria Rivera" }],
  },
];
const SPONSORS = [{ id: "s-1", business_name: "Hoka" }];
const idle = {
  current_heat_id: null,
  active_graphic: "none" as const,
  lower_third_athlete_id: null,
  active_sponsor_id: null,
  timer_status: "idle" as const,
};

describe("onAirSummary", () => {
  it("says nothing is on air", () => {
    expect(onAirSummary(idle, HEATS, SPONSORS)).toEqual({
      heatLabel: null,
      graphicLabel: "None",
      lowerThirdName: null,
      sponsorName: null,
      timerStateLabel: "Idle",
    });
  });

  it("names everything on air", () => {
    expect(
      onAirSummary(
        {
          current_heat_id: "h-6",
          active_graphic: "lanes",
          lower_third_athlete_id: "a-1",
          active_sponsor_id: "s-1",
          timer_status: "running",
        },
        HEATS,
        SPONSORS,
      ),
    ).toEqual({
      heatLabel: "WOD 2 · Heat 6 / 9 · Intermediate Female",
      graphicLabel: "Lanes",
      lowerThirdName: "Maria Rivera",
      sponsorName: "Hoka",
      timerStateLabel: "Running",
    });
  });

  it("says 'On air' for ids it can't name", () => {
    const s = onAirSummary(
      { ...idle, lower_third_athlete_id: "gone", active_sponsor_id: "gone" },
      HEATS,
      SPONSORS,
    );
    expect(s.lowerThirdName).toBe("On air");
    expect(s.sponsorName).toBe("On air");
  });

  it("handles no state yet", () => {
    expect(onAirSummary(null, HEATS, SPONSORS).heatLabel).toBeNull();
  });
});

describe("confirmations", () => {
  it.each([
    ["idle", false],
    ["ended", false],
    ["running", true],
    ["paused", true],
    [undefined, false],
  ] as const)("timer %s asks before a restart or heat switch: %s", (status, asks) => {
    expect(needsRestartConfirm(status)).toBe(asks);
    expect(needsHeatSwitchConfirm(status)).toBe(asks);
  });
});
