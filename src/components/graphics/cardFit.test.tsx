// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HeatResults } from "./HeatResults";
import { Leaderboard } from "./Leaderboard";
import { WodCard } from "./WodCard";

afterEach(cleanup);

const lane = (n: number) => ({ laneNumber: n, name: `Athlete ${n}`, value: "03:45", placement: n });

describe("cards keep to the stage whatever the data", () => {
  it("puts results past six lanes into two columns", () => {
    const { container } = render(
      <HeatResults title="WOD 2 · Heat 6 — Results" rows={[1, 2, 3, 4, 5, 6, 7, 8].map(lane)} />,
    );
    expect(container.querySelector("[data-columns]")?.getAttribute("data-columns")).toBe("2");
    const few = render(<HeatResults title="t" rows={[1, 2, 3].map(lane)} />);
    expect(few.container.querySelector("[data-columns]")?.getAttribute("data-columns")).toBe("1");
  });

  it("shows at most ten rows on the compact leaderboard", () => {
    render(
      <Leaderboard
        title="Rx — Overall"
        rows={Array.from({ length: 30 }, (_, i) => ({
          placement: i + 1,
          name: `Athlete ${i + 1}`,
          value: "1 pts",
        }))}
      />,
    );
    expect(screen.getByText("Athlete 10")).toBeTruthy();
    expect(screen.queryByText("Athlete 11")).toBeNull();
  });

  it("steps a long WOD description down and clamps it", () => {
    const long = "21-15-9 thrusters and pull-ups, then ".repeat(30);
    render(<WodCard fullScreen name="Chipper" description={long} timeCapSeconds={null} />);
    const p = screen.getByText((t) => t.startsWith("21-15-9"));
    expect(p.className).toContain("text-bc-label");
    expect(p.className).toMatch(/line-clamp-/);
  });
});
