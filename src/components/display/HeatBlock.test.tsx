// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CurrentHeatBlock } from "./HeatBlock";

const heat = (lanes: number) => ({
  id: "h",
  heatNumber: 1,
  heatCount: 2,
  endedAt: null,
  wod: {
    id: "w",
    name: "Fran",
    description: null,
    scoring_type: "time",
    time_cap_seconds: null,
    created_at: "",
  },
  division: { id: "d", name: "Rx" },
  lanes: Array.from({ length: lanes }, (_, i) => ({
    laneNumber: i + 1,
    athleteId: `a${i}`,
    name: `Athlete ${i + 1}`,
    affiliate: "Box 787",
  })),
});

afterEach(cleanup);

describe("HeatBlock", () => {
  it("shows affiliates on a heat of eight", () => {
    render(<CurrentHeatBlock heat={heat(8)} eventName="E" />);
    expect(screen.getAllByText("Box 787")).toHaveLength(8);
  });
  it("drops affiliates past eight lanes so every lane fits the screen", () => {
    render(<CurrentHeatBlock heat={heat(9)} eventName="E" />);
    expect(screen.queryByText("Box 787")).toBeNull();
    expect(screen.getByText("Athlete 9")).toBeTruthy();
  });
});
