// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.stubGlobal("matchMedia", (q: string) => ({
  matches: false,
  media: q,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));

import { type ScoreRow, ScoresTable } from "./ScoresTable";

const ROWS: ScoreRow[] = [
  {
    id: "r-1",
    competitor: "Maria Rivera",
    wodName: "WOD 2",
    heatNumber: 6,
    divisionName: "Intermediate Female",
    score: "03:45",
    status: "completed",
    adjusted: false,
    floorId: "f-1",
  },
  {
    id: "r-2",
    competitor: "Camila Ortiz",
    wodName: "WOD 2",
    heatNumber: 6,
    divisionName: "Intermediate Female",
    score: "DNF",
    status: "dnf",
    adjusted: true,
    floorId: "f-1",
  },
];

afterEach(cleanup);

describe("ScoresTable", () => {
  it("shows each result's score, status and adjustment", () => {
    render(<ScoresTable rows={ROWS} wods={["WOD 2"]} divisions={["Intermediate Female"]} />);
    expect(screen.getByText("03:45")).toBeTruthy();
    expect(screen.getAllByText("DNF").length).toBeGreaterThan(0);
    expect(screen.getByText("Adjusted")).toBeTruthy();
    expect(screen.getAllByText("Heat 6").length).toBe(2);
  });

  it("searches by competitor", async () => {
    render(<ScoresTable rows={ROWS} wods={["WOD 2"]} divisions={["Intermediate Female"]} />);
    await userEvent
      .setup()
      .type(screen.getByRole("searchbox", { name: "Search scores" }), "camila");
    expect(screen.queryByText("Maria Rivera")).toBeNull();
    expect(screen.getByText("Camila Ortiz")).toBeTruthy();
  });
});
