// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DisplayError from "./error";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("venue display error screen", () => {
  it("stands by and tries again every five seconds", () => {
    const reset = vi.fn();
    render(<DisplayError error={new Error("network")} reset={reset} />);
    expect(screen.getByTestId("display-standby")).toBeTruthy();
    act(() => vi.advanceTimersByTime(5_000));
    expect(reset).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(5_000));
    expect(reset).toHaveBeenCalledTimes(2);
  });
});
