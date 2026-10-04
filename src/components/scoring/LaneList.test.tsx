// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LaneResult } from "@/lib/scoring/format";
import { LaneList, resultsByAthlete } from "./LaneList";

const result = (over: Partial<LaneResult>): LaneResult => ({
  athlete_id: "a-1",
  time_seconds: 252,
  reps: null,
  load: null,
  points: null,
  capped: false,
  status: "completed",
  tiebreak_value: null,
  manually_adjusted: false,
  ...over,
});

const LANES = [
  { laneNumber: 1, athleteId: "a-1", name: "Maria Rivera", affiliate: "CrossFit Aprieta" },
  { laneNumber: 2, athleteId: "a-2", name: "Ana López", affiliate: null },
  { laneNumber: 3, athleteId: "a-3", name: "Carla Ortiz", affiliate: null },
];

afterEach(cleanup);

describe("LaneList", () => {
  it("shows each lane's summary and state, and opens a lane", async () => {
    const onOpen = vi.fn();
    render(
      <LaneList
        lanes={LANES}
        scoringType="for_time"
        resultsByAthlete={resultsByAthlete([
          result({ athlete_id: "a-1" }),
          result({ athlete_id: "a-2", status: "dnf", manually_adjusted: true }),
        ])}
        onOpen={onOpen}
      />,
    );
    const row1 = screen.getByRole("button", { name: /Lane 1/ });
    expect(within(row1).getByText("04:12")).toBeTruthy();
    expect(within(row1).getByText("Recorded")).toBeTruthy();
    expect(within(row1).getByText("CrossFit Aprieta")).toBeTruthy();
    const row2 = screen.getByRole("button", { name: /Lane 2/ });
    expect(within(row2).getByText("DNF")).toBeTruthy();
    expect(within(row2).getByText("Adjusted")).toBeTruthy();
    const row3 = screen.getByRole("button", { name: /Lane 3/ });
    expect(within(row3).getByText("—")).toBeTruthy();
    expect(within(row3).getByText("Pending")).toBeTruthy();
    await userEvent.setup().click(row3);
    expect(onOpen).toHaveBeenCalledWith(LANES[2]);
  });
});
