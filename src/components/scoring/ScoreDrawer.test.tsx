// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LaneResult, ScoringType } from "@/lib/scoring/format";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.stubGlobal("matchMedia", (q: string) => ({
  matches: false,
  media: q,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));
// Radix Switch measures itself; jsdom has no ResizeObserver.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
const enterResult = vi.hoisted(() => vi.fn());
vi.mock("@/lib/actions/results", () => ({ enterResult }));

import { ScoreDrawer } from "./ScoreDrawer";

const LANE = { laneNumber: 3, athleteId: "a-3", name: "Carla Ortiz", affiliate: null };

function setup(opts: { scoringType?: ScoringType; existing?: LaneResult } = {}) {
  const onClose = vi.fn();
  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <ScoreDrawer
        heatId="h-1"
        lane={LANE}
        existing={opts.existing}
        scoringType={opts.scoringType ?? "for_time"}
        subtitle="WOD 2 · Intermediate Female"
        onClose={onClose}
      />
    </QueryClientProvider>,
  );
  return { user: userEvent.setup(), onClose, view };
}

afterEach(() => {
  cleanup();
  enterResult.mockReset();
});

describe("ScoreDrawer", () => {
  it("posts minutes and seconds as m:ss", async () => {
    enterResult.mockResolvedValue({ ok: true });
    const { user, onClose } = setup();
    await user.type(screen.getByLabelText("Minutes"), "3");
    await user.type(screen.getByLabelText("Seconds"), "45");
    await user.click(screen.getByRole("button", { name: "Save lane" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const fd = enterResult.mock.calls[0][1] as FormData;
    expect(enterResult.mock.calls[0][0]).toBe("h-1");
    expect(fd.get("time_seconds")).toBe("3:45");
    expect(fd.get("competitor_id")).toBe("a-3");
    expect(fd.get("status")).toBe("completed");
  });

  it("hides score fields on DNF and keeps the time when switching back", async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText("Minutes"), "4");
    await user.click(screen.getByRole("radio", { name: "DNF" }));
    expect(screen.queryByLabelText("Minutes")).toBeNull();
    await user.click(screen.getByRole("radio", { name: "Completed" }));
    expect(screen.getByLabelText("Minutes")).toHaveProperty("value", "4");
  });

  it("asks before discarding a changed form", async () => {
    const { user, onClose } = setup();
    await user.type(screen.getByLabelText("Minutes"), "3");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("Discard changes to lane 3?")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByLabelText("Minutes")).toHaveProperty("value", "3");
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("closes an unchanged form at once", async () => {
    const { user, onClose } = setup();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows a time error under the time fields and stays open", async () => {
    enterResult.mockResolvedValue({
      ok: false,
      message: "Time must be a time like 3:45, or seconds.",
      fieldErrors: { time_seconds: ["Time must be a time like 3:45, or seconds."] },
    });
    const { user, onClose } = setup();
    await user.type(screen.getByLabelText("Seconds"), "7x");
    await user.click(screen.getByRole("button", { name: "Save lane" }));
    expect(await screen.findByText("Time must be a time like 3:45, or seconds.")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Seconds")).toHaveProperty("value", "7x");
  });

  it("keeps typed values when the saved result changes underneath", async () => {
    const { user, view } = setup();
    await user.type(screen.getByLabelText("Minutes"), "5");
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <ScoreDrawer
          heatId="h-1"
          lane={LANE}
          existing={{
            athlete_id: "a-3",
            time_seconds: 60,
            reps: null,
            load: null,
            points: null,
            capped: false,
            status: "completed",
            tiebreak_value: null,
            manually_adjusted: false,
          }}
          scoringType="for_time"
          subtitle="WOD 2 · Intermediate Female"
          onClose={vi.fn()}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByLabelText("Minutes")).toHaveProperty("value", "5");
  });

  it("shows reps only when capped", async () => {
    const { user } = setup();
    expect(screen.queryByLabelText("Reps")).toBeNull();
    await user.click(screen.getByRole("switch", { name: "Time-capped" }));
    expect(screen.getByLabelText("Reps")).toBeTruthy();
  });

  it("shows one field for AMRAP", () => {
    setup({ scoringType: "amrap" });
    expect(screen.getByLabelText("Total reps")).toBeTruthy();
    expect(screen.queryByLabelText("Minutes")).toBeNull();
  });
});
