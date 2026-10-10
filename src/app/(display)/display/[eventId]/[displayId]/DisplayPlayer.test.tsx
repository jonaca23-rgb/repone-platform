// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EventSponsor } from "@/lib/db/sponsors";
import type { DisplaySnapshot } from "@/lib/display/snapshot";

const realtime = vi.hoisted(() => ({ connected: true }));
vi.mock("@/lib/realtime/useBroadcastState", () => ({
  useBroadcastState: () => ({ state: { current_heat_id: "h-1" }, connected: realtime.connected }),
}));
vi.mock("@/lib/realtime/useDivisionStandings", () => ({
  useDivisionStandings: () => ({ wods: [], rows: [], loading: false }),
}));
vi.mock("@/lib/realtime/useRefreshOnChanges", () => ({ useRefreshOnChanges: () => {} }));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { DisplayPlayer } from "./DisplayPlayer";

const HEAT = {
  id: "h-1",
  heatNumber: 2,
  heatCount: 4,
  endedAt: null,
  wod: {
    id: "w",
    name: "Fran",
    description: null,
    scoring_type: "time",
    time_cap_seconds: null,
    created_at: "2026-01-01",
  },
  division: { id: "d", name: "Rx Male" },
  lanes: [{ laneNumber: 1, athleteId: "a", name: "Maria Rivera", affiliate: "Aprieta" }],
};

const sponsor = (id: string, name: string): EventSponsor => ({
  sponsorshipId: `es-${id}`,
  sponsorId: id,
  businessName: name,
  logoUrl: null,
  packageId: "p",
  packageName: "Logo Sponsor",
  display: { enabled: true, durationSeconds: 10, weight: 1 },
  creatives: [],
});

function snapshot(over: Partial<DisplaySnapshot> = {}): DisplaySnapshot {
  return {
    device: {
      id: "d-1",
      eventId: "ev",
      floorId: "f",
      name: "Entrance",
      enabled: true,
      sponsorsEnabled: true,
      infoBlocksBetweenSponsors: 1,
    },
    blocks: [{ type: "current_heat", enabled: true, durationSeconds: 15, weight: 1 }],
    sponsors: [sponsor("a", "Borinquen Nutrition")],
    heats: [HEAT],
    eventName: "Aprieta Entry Level",
    ...over,
  };
}

const start = () => act(() => vi.advanceTimersByTime(0));
const after = (s: number) => act(() => vi.advanceTimersByTime(s * 1000));

beforeEach(() => {
  vi.useFakeTimers();
  realtime.connected = true;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("DisplayPlayer", () => {
  it("opens on a sponsor, then shows the live heat after the sponsor's time", () => {
    render(<DisplayPlayer snapshot={snapshot()} initialBroadcastState={null} />);
    start();
    expect(screen.getByText("Borinquen Nutrition")).toBeTruthy();
    after(10);
    expect(screen.getByText("Now on the floor")).toBeTruthy();
    expect(screen.getByText("Maria Rivera")).toBeTruthy();
  });

  it("stands by when there is nothing to show, and retries", () => {
    const { rerender } = render(
      <DisplayPlayer
        snapshot={snapshot({ sponsors: [], heats: [] })}
        initialBroadcastState={null}
      />,
    );
    start();
    expect(screen.getByTestId("display-standby")).toBeTruthy();
    rerender(<DisplayPlayer snapshot={snapshot({ heats: [] })} initialBroadcastState={null} />);
    after(5);
    expect(screen.getByText("Borinquen Nutrition")).toBeTruthy();
  });

  it("never shows a sponsor again once its sponsorship is gone", () => {
    const two = [sponsor("a", "Borinquen Nutrition"), sponsor("b", "San Juan Sports Gear")];
    const { rerender } = render(
      <DisplayPlayer
        snapshot={snapshot({ sponsors: two, heats: [] })}
        initialBroadcastState={null}
      />,
    );
    start();
    rerender(
      <DisplayPlayer
        snapshot={snapshot({ sponsors: [two[1]], heats: [] })}
        initialBroadcastState={null}
      />,
    );
    for (let i = 0; i < 6; i++) {
      expect(screen.queryByText("Borinquen Nutrition")).toBeNull();
      after(10);
    }
    expect(screen.getByText("San Juan Sports Gear")).toBeTruthy();
  });

  it("stands by while the display is switched off", () => {
    const off = snapshot();
    off.device = { ...off.device, enabled: false };
    render(<DisplayPlayer snapshot={off} initialBroadcastState={null} />);
    start();
    expect(screen.getByTestId("display-standby")).toBeTruthy();
    after(10);
    expect(screen.queryByText("Borinquen Nutrition")).toBeNull();
  });

  it("drops heat info after five minutes when Realtime never connected", () => {
    realtime.connected = false;
    render(<DisplayPlayer snapshot={snapshot()} initialBroadcastState={null} />);
    start();
    after(10);
    expect(screen.getByText("Now on the floor")).toBeTruthy();
    after(5 * 60);
    for (let i = 0; i < 4; i++) {
      after(15);
      expect(screen.queryByText("Now on the floor")).toBeNull();
    }
  });

  it("keeps standing by without fading in again on every retry", () => {
    const off = snapshot();
    off.device = { ...off.device, enabled: false };
    render(<DisplayPlayer snapshot={off} initialBroadcastState={null} />);
    start();
    const standby = screen.getByTestId("display-standby");
    after(15);
    expect(screen.getByTestId("display-standby")).toBe(standby);
  });

  it("re-reads its snapshot once a minute, for changes Realtime can't deliver", () => {
    router.refresh.mockClear();
    render(<DisplayPlayer snapshot={snapshot()} initialBroadcastState={null} />);
    after(60);
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });
});
