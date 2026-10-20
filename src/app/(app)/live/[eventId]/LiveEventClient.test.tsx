// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
vi.mock("@/lib/realtime/useFloorOverlay", () => ({
  useFloorOverlay: () => ({ state: null, connected: true, currentHeat: null }),
}));
vi.mock("@/lib/realtime/useLiveTimer", () => ({
  useLiveTimer: () => ({ displaySeconds: 0, atLimit: false }),
}));
const standings = vi.hoisted(() => ({
  current: (_id: string | null) => ({
    loading: false,
    wods: [{ id: "w1", name: "WOD 1" }],
    rows: [{ key: "a", placement: 1, points: 3, name: "Maria Rivera", wodPlacements: { w1: 2 } }],
  }),
}));
vi.mock("@/lib/realtime/useDivisionStandings", () => ({
  useDivisionStandings: (id: string | null) => standings.current(id),
}));

import { LiveEventClient } from "./LiveEventClient";

const DIVISIONS = [
  { id: "d1", name: "Intermediate Female" },
  { id: "d2", name: "Rx Male" },
];
const FLOORS = [
  { floorId: "f", floorName: "Floor A", venueName: "Main", heats: [], initialBroadcastState: null },
] as never;

let replace: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  window.history.pushState({}, "", "/live/ev");
  replace = vi.spyOn(window.history, "replaceState");
});
afterEach(() => {
  cleanup();
  replace.mockRestore();
});

describe("LiveEventClient", () => {
  it("opens on Now and switches to Standings, keeping it in the URL", async () => {
    render(<LiveEventClient floors={FLOORS} divisions={DIVISIONS} />);
    expect(screen.getByRole("tab", { name: "Now", selected: true })).toBeTruthy();
    await userEvent.setup().click(screen.getByRole("tab", { name: "Standings" }));
    expect(screen.getByRole("tab", { name: "Standings", selected: true })).toBeTruthy();
    expect(String(replace.mock.calls.at(-1)?.[2])).toContain("tab=standings");
  });

  it("opens the tab and division the link names, with WOD placings", () => {
    window.history.pushState({}, "", "/live/ev?tab=standings&division=d2");
    const seen: Array<string | null> = [];
    standings.current = (id) => {
      seen.push(id);
      return {
        loading: false,
        wods: [{ id: "w1", name: "WOD 1" }],
        rows: [
          { key: "a", placement: 1, points: 3, name: "Maria Rivera", wodPlacements: { w1: 2 } },
        ],
      };
    };
    render(<LiveEventClient floors={FLOORS} divisions={DIVISIONS} />);
    expect(screen.getByRole("tab", { name: "Standings", selected: true })).toBeTruthy();
    expect(seen).toContain("d2");
    expect(screen.getByText("2nd")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "WOD 1" })).toBeTruthy();
    expect(screen.getByText("Maria Rivera")).toBeTruthy();
  });

  it("falls back to the first division for one that isn't in this event", () => {
    window.history.pushState({}, "", "/live/ev?tab=standings&division=nope");
    const seen: Array<string | null> = [];
    standings.current = (id) => {
      seen.push(id);
      return { loading: false, wods: [], rows: [] };
    };
    render(<LiveEventClient floors={FLOORS} divisions={DIVISIONS} />);
    expect(seen.at(-1)).toBe("d1");
    expect(
      screen.getByText("No scored results yet. Standings fill in as heats are finished."),
    ).toBeTruthy();
  });

  it("opens on Standings when the page asks for it, and shows skeletons while loading", () => {
    standings.current = () => ({ loading: true, wods: [], rows: [] });
    render(<LiveEventClient floors={FLOORS} divisions={DIVISIONS} defaultTab="standings" />);
    expect(screen.getByRole("tab", { name: "Standings", selected: true })).toBeTruthy();
    expect(screen.getAllByTestId("standings-skeleton").length).toBe(3);
  });
});
