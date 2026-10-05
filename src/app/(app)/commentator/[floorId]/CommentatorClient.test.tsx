// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
vi.mock("@/lib/realtime/useBroadcastState", () => ({
  useBroadcastState: (_f: string, initial: unknown) => ({ state: initial, connected: true }),
}));

import type { CommentatorAthleteDetails } from "@/lib/db/commentator";
import type { FloorHeat } from "@/lib/db/queries";
import { CommentatorClient } from "./CommentatorClient";

const heat = (n: number, athletes: string[]): FloorHeat =>
  ({
    id: `h-${n}`,
    heatNumber: n,
    heatCount: 2,
    endedAt: null,
    wod: {
      id: "w",
      name: "WOD 2",
      description: n === 1 ? "21-15-9 thrusters and pull-ups" : null,
      scoring_type: "for_time",
      time_cap_seconds: n === 1 ? 900 : null,
      created_at: "",
    },
    division: { id: "d", name: "Intermediate Female" },
    lanes: athletes.map((a, i) => ({
      laneNumber: i + 1,
      athleteId: a,
      name: `Athlete ${a}`,
      affiliate: i === 0 ? "CrossFit Aprieta" : null,
    })),
  }) as FloorHeat;

const chip = (i: number) => ({ id: `l${i}`, label: `Lift ${i}`, valueDisplay: `${i}0 lb` });
const DETAILS: Record<string, CommentatorAthleteDetails> = {
  a: {
    ageCategoryLabel: "Masters",
    lifts: [chip(1), chip(2), chip(3)] as never,
    benchmarks: [
      { id: "b1", name: "Fran", resultDisplay: "3:45" },
      { id: "b2", name: "Grace", resultDisplay: "2:10" },
    ] as never,
    history: [
      {
        eventId: "e1",
        eventName: "Aprieta 2025",
        divisionName: "Int F",
        overall: { placement: 2 },
        wods: [],
      },
      { eventId: "e2", eventName: "Open 2025", divisionName: "Int F", overall: null, wods: [] },
      { eventId: "e3", eventName: "Summer 2024", divisionName: "Int F", overall: null, wods: [] },
    ] as never,
  },
  b: {
    ageCategoryLabel: null,
    lifts: [chip(1)] as never,
    benchmarks: [] as never,
    history: [] as never,
  },
};

const HEATS = [heat(1, ["a", "b", "c"]), heat(2, ["d"])];
const live = { current_heat_id: "h-1" } as never;

afterEach(cleanup);

describe("CommentatorClient", () => {
  it("shows a compact card per laned athlete", () => {
    render(
      <CommentatorClient
        floorId="f"
        heats={HEATS}
        initialBroadcastState={live}
        detailsByAthleteId={DETAILS}
      />,
    );
    expect(screen.getByText("Athlete a")).toBeTruthy();
    expect(screen.getByText("Athlete b")).toBeTruthy();
    expect(screen.getByText("Athlete c")).toBeTruthy();
    // 5 stats for a: 4 chips + "+1 more"
    expect(screen.getByText("+1 more")).toBeTruthy();
    expect(screen.queryByText(/Grace/)).toBeNull();
    // b has exactly 1 stat: no "+N more"
    expect(screen.getAllByText(/\+\d+ more$/).length).toBe(1);
    // history beyond the first is folded
    expect(screen.getByText("Aprieta 2025")).toBeTruthy();
    expect(screen.getByText("+2 more events")).toBeTruthy();
    // c has no details at all
    expect(screen.getByText("No lifts, benchmarks or history on file yet.")).toBeTruthy();
  });

  it("shows the current WOD and follows the live heat", async () => {
    render(
      <CommentatorClient
        floorId="f"
        heats={HEATS}
        initialBroadcastState={live}
        detailsByAthleteId={DETAILS}
      />,
    );
    expect(screen.getByText("WOD 2 · For time · 15 min cap")).toBeTruthy();
    expect(screen.getByText("Following live heat")).toBeTruthy();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Next heat" }));
    expect(screen.getByText("Athlete d")).toBeTruthy();
    expect(screen.getByText("WOD 2 · For time")).toBeTruthy();
    expect(screen.getByText("No description on file.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Follow live heat/ }));
    expect(screen.getByText("Athlete a")).toBeTruthy();
  });
});
