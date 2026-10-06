// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Appear, EXIT_MS } from "./Appear";

function motion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: reduce && q === "(prefers-reduced-motion: reduce)",
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Appear", () => {
  it("enters, then plays its exit before unmounting", () => {
    motion(false);
    const view = render(
      <Appear show variant="rise">
        <p>Card</p>
      </Appear>,
    );
    expect(screen.getByText("Card").closest("[data-appear]")?.getAttribute("data-appear")).toBe(
      "in",
    );
    view.rerender(
      <Appear show={false} variant="rise">
        <p>Card</p>
      </Appear>,
    );
    expect(screen.getByText("Card").closest("[data-appear]")?.getAttribute("data-appear")).toBe(
      "out",
    );
    act(() => vi.advanceTimersByTime(EXIT_MS));
    expect(screen.queryByText("Card")).toBeNull();
  });

  it("swaps content in place while shown", () => {
    motion(false);
    const view = render(
      <Appear show variant="slide-left">
        <p>Maria</p>
      </Appear>,
    );
    view.rerender(
      <Appear show variant="slide-left">
        <p>Sofia</p>
      </Appear>,
    );
    expect(screen.getByText("Sofia")).toBeTruthy();
    expect(screen.queryByText("Maria")).toBeNull();
  });

  it("leaves at once with reduced motion", () => {
    motion(true);
    const view = render(
      <Appear show variant="fade">
        <p>Clock</p>
      </Appear>,
    );
    view.rerender(
      <Appear show={false} variant="fade">
        <p>Clock</p>
      </Appear>,
    );
    expect(screen.queryByText("Clock")).toBeNull();
  });
});
