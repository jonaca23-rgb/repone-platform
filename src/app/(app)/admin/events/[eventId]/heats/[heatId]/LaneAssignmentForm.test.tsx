// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/lib/actions/lanes", () => ({ assignLane: vi.fn() }));

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

  it("shows a team of this division as itself", () => {
    renderLane({ id: "t1", label: "Aprieta Duo", kind: "team" });
    expect(screen.getByRole("combobox").textContent).toBe("Aprieta Duo");
  });
});
