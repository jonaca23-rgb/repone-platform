// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  unstable_rethrow: () => {},
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { OnAirBar } from "./OnAirBar";

const nothing = {
  heatLabel: null,
  graphicLabel: "None",
  lowerThirdName: null,
  sponsorName: null,
  timerStateLabel: "Idle",
};

afterEach(cleanup);

describe("OnAirBar", () => {
  it("says no heat is on air and offers to put one on", async () => {
    const onPutOnAir = vi.fn();
    render(
      <OnAirBar
        connected
        pending={false}
        summary={nothing}
        timerSeconds={0}
        offAirHeatNumber={1}
        onPutOnAir={onPutOnAir}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByText("No heat on air")).toBeTruthy();
    await userEvent.setup().click(screen.getByRole("button", { name: "Put Heat 1 on air" }));
    expect(onPutOnAir).toHaveBeenCalled();
  });

  it("names what the audience sees", () => {
    render(
      <OnAirBar
        connected
        pending={false}
        summary={{
          heatLabel: "WOD 2 · Heat 6 / 9 · Intermediate Female",
          graphicLabel: "Lanes",
          lowerThirdName: "Maria Rivera",
          sponsorName: "Hoka",
          timerStateLabel: "Running",
        }}
        timerSeconds={462}
        offAirHeatNumber={null}
        onPutOnAir={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    const bar = screen.getByRole("region", { name: "On air" });
    expect(bar.textContent).toContain("WOD 2 · Heat 6 / 9 · Intermediate Female");
    expect(bar.textContent).toContain("07:42");
    expect(bar.textContent).toContain("Running");
    expect(bar.textContent).toContain("Lanes");
    expect(bar.textContent).toContain("Maria Rivera");
    expect(bar.textContent).toContain("Hoka");
    expect(screen.queryByRole("button", { name: /on air/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Clear all" })).toBeTruthy();
  });
});
