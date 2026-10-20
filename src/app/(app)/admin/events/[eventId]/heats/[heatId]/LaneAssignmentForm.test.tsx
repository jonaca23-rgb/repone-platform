// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
const assignLane = vi.hoisted(() => vi.fn());
vi.mock("@/lib/actions/lanes", () => ({ assignLane }));

import { LaneAssignmentForm } from "./LaneAssignmentForm";

afterEach(cleanup);

function renderLane(occupant: { id: string; label: string; kind: "athlete" | "team" } | null) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <LaneAssignmentForm
        eventId="e1"
        heatId="h1"
        lane={{ id: "l1", lane_number: 3, occupant }}
        kind="team"
        options={[{ id: "t1", label: "Aprieta Duo" }]}
      />
    </QueryClientProvider>,
  );
}

describe("LaneAssignmentForm", () => {
  it("names an occupant of the wrong kind instead of showing a blank lane", () => {
    renderLane({ id: "a1", label: "Maria Rivera", kind: "athlete" });
    expect(screen.getByRole("combobox").textContent).toBe(
      "Maria Rivera (wrong kind for this division)",
    );
  });

  it("asks for a replacement instead of saving a wrong-kind occupant as it is", async () => {
    renderLane({ id: "a1", label: "Maria Rivera", kind: "athlete" });
    await userEvent.setup().click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert").textContent).toBe(
      "Choose a team, or Empty, to replace Maria Rivera in lane 3.",
    );
    expect(assignLane).not.toHaveBeenCalled();
  });

  it("shows a team of this division as itself", () => {
    renderLane({ id: "t1", label: "Aprieta Duo", kind: "team" });
    expect(screen.getByRole("combobox").textContent).toBe("Aprieta Duo");
  });
});
