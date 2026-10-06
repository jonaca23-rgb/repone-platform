// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  state: null as Record<string, unknown> | null,
  athlete: null as null | { name: string; division: string | null; affiliate: string | null },
}));
const HEAT = {
  id: "h-6",
  heatNumber: 6,
  heatCount: 9,
  endedAt: null,
  wod: {
    id: "w",
    name: "WOD 2",
    description: "21-15-9",
    scoring_type: "for_time",
    time_cap_seconds: 900,
    created_at: "",
  },
  division: { id: "d", name: "Intermediate Female" },
  lanes: [{ laneNumber: 1, athleteId: "a-1", name: "Maria Rivera", affiliate: "CrossFit Aprieta" }],
};
vi.mock("@/lib/realtime/useFloorOverlay", () => ({
  useFloorOverlay: () => ({ state: fixture.state, connected: true, currentHeat: HEAT }),
}));
vi.mock("@/lib/realtime/useLiveTimer", () => ({
  useLiveTimer: () => ({ displaySeconds: 462, atLimit: false }),
}));
vi.mock("@/lib/realtime/useStandings", () => ({
  useStandings: () => [{ placement: 1, points: 3, name: "Sofia Delgado" }],
}));
vi.mock("@/lib/realtime/useHeatResults", () => ({ useHeatResults: () => new Map() }));
vi.mock("@/lib/realtime/useAthleteLookup", () => ({ useAthleteLookup: () => fixture.athlete }));

import { ProgramOverlayClient } from "./ProgramOverlayClient";

const state = (active_graphic: string, lower_third_athlete_id: string | null = null) => ({
  active_graphic,
  lower_third_athlete_id,
  active_sponsor_id: null,
  current_heat_id: "h-6",
  timer_status: "running",
});

function renderProgram() {
  return render(
    <ProgramOverlayClient
      floorId="f"
      eventId="ev"
      heats={[HEAT] as never}
      initialBroadcastState={null}
      sponsors={[]}
    />,
  );
}

beforeEach(() => {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: false,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  fixture.athlete = null;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ProgramOverlayClient", () => {
  it("puts the clock and heat strip in the corners instead of a full-frame timer", () => {
    fixture.state = state("timer");
    renderProgram();
    expect(screen.getByText("07:42")).toBeTruthy();
    expect(screen.getByText(/WOD 2 · Heat 6/)).toBeTruthy();
    expect(screen.queryByText("Maria Rivera")).toBeNull();
  });

  it("shows a lower third over a card", () => {
    fixture.state = state("lanes", "a-1");
    fixture.athlete = { name: "Ana Lopez", division: "Rx", affiliate: null };
    renderProgram();
    expect(screen.getByText("Maria Rivera")).toBeTruthy();
    expect(screen.getByText("Ana Lopez")).toBeTruthy();
  });

  it("lets the old card leave while the new one comes in", () => {
    fixture.state = state("lanes");
    const view = renderProgram();
    fixture.state = state("leaderboard");
    view.rerender(
      <ProgramOverlayClient
        floorId="f"
        eventId="ev"
        heats={[HEAT] as never}
        initialBroadcastState={null}
        sponsors={[]}
      />,
    );
    expect(
      screen.getByText("Maria Rivera").closest("[data-appear]")?.getAttribute("data-appear"),
    ).toBe("out");
    expect(
      screen.getByText("Sofia Delgado").closest("[data-appear]")?.getAttribute("data-appear"),
    ).toBe("in");
  });
});
