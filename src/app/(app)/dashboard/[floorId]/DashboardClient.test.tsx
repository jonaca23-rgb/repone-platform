// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  unstable_rethrow: () => {},
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/realtime/useBroadcastState", () => ({
  useBroadcastState: (_floorId: string, initial: unknown) => ({ state: initial, connected: true }),
}));
vi.mock("@/lib/realtime/useRefreshOnChanges", () => ({ useRefreshOnChanges: () => {} }));
vi.mock("@/lib/realtime/floorWatches", () => ({ floorWatches: () => [] }));
vi.mock("@/lib/realtime/useLiveTimer", () => ({
  useLiveTimer: () => ({ displaySeconds: 462, atLimit: false }),
}));
const actions = vi.hoisted(() => ({
  setCurrentHeat: vi.fn(async () => ({ ok: true })),
  setActiveGraphic: vi.fn(async () => ({ ok: true })),
  setLowerThird: vi.fn(async () => ({ ok: true })),
  setActiveSponsor: vi.fn(async () => ({ ok: true })),
  clearGraphics: vi.fn(async () => ({ ok: true })),
  startTimer: vi.fn(async () => ({ ok: true })),
  pauseTimer: vi.fn(async () => ({ ok: true })),
  resumeTimer: vi.fn(async () => ({ ok: true })),
  resetTimer: vi.fn(async () => ({ ok: true })),
  adjustTimer: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/actions/broadcast", () => actions);

import { DashboardClient, type DashboardHeat } from "./DashboardClient";

const heat = (n: number): DashboardHeat => ({
  id: `h-${n}`,
  heatNumber: n,
  heatCount: 2,
  wod: { id: "w", name: "WOD 2", scoring_type: "for_time", time_cap_seconds: 600 },
  division: { id: "d", name: "Intermediate Female" },
  lanes: [{ laneNumber: 1, athleteId: `a-${n}`, name: `Athlete ${n}`, affiliate: null }],
});
const HEATS = [heat(1), heat(2)];

function state(timer_status: "idle" | "running" | "paused" | "ended", current_heat_id = "h-1") {
  return {
    floor_id: "f",
    current_heat_id,
    active_graphic: "none",
    lower_third_athlete_id: null,
    active_sponsor_id: null,
    timer_status,
    timer_direction: "count_down",
    timer_duration_seconds: 600,
    timer_elapsed_at_anchor: 0,
    timer_anchor_time: null,
    updated_at: "",
  } as never;
}

function setup(s: ReturnType<typeof state>) {
  render(
    <DashboardClient
      floorId="f"
      eventId="ev"
      eventName="Aprieta"
      heats={HEATS}
      initialBroadcastState={s}
      sponsors={[]}
    />,
  );
  return userEvent.setup();
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DashboardClient", () => {
  it("switches heats at once when the timer is idle", async () => {
    const user = setup(state("idle"));
    await user.click(screen.getByRole("button", { name: /Next heat/ }));
    await waitFor(() => expect(actions.setCurrentHeat).toHaveBeenCalledWith("f", "h-2"));
  });

  it("asks before switching heats while the timer runs", async () => {
    const user = setup(state("running"));
    await user.click(screen.getByRole("button", { name: /Next heat/ }));
    expect(actions.setCurrentHeat).not.toHaveBeenCalled();
    expect(screen.getByText("Switch to Heat 2?")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Switch heat" }));
    await waitFor(() => expect(actions.setCurrentHeat).toHaveBeenCalledWith("f", "h-2"));
  });

  it("asks before restarting a running timer", async () => {
    const user = setup(state("running"));
    await user.click(screen.getByRole("button", { name: "Start" }));
    expect(actions.startTimer).not.toHaveBeenCalled();
    expect(screen.getByText("Restart the timer?")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Restart timer" }));
    await waitFor(() => expect(actions.startTimer).toHaveBeenCalled());
  });

  it("starts an idle timer at once", async () => {
    const user = setup(state("idle"));
    await user.click(screen.getByRole("button", { name: "Start" }));
    await waitFor(() => expect(actions.startTimer).toHaveBeenCalledWith("f", "count_down", 600));
  });

  it("puts the first heat on air without asking", async () => {
    const user = setup(state("running", null as never));
    expect(screen.getByText("No heat on air")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Put Heat 1 on air" }));
    await waitFor(() => expect(actions.setCurrentHeat).toHaveBeenCalledWith("f", "h-1"));
  });

  it("shows the server's message when a control fails", async () => {
    actions.setActiveGraphic.mockResolvedValueOnce({
      ok: false,
      message: "This floor's broadcast controls aren't available to your account.",
    } as never);
    const user = setup(state("idle"));
    await user.click(screen.getByRole("button", { name: "Show Lanes" }));
    expect(
      await screen.findByText("This floor's broadcast controls aren't available to your account."),
    ).toBeTruthy();
  });
});
