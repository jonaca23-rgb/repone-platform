// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({
  Toaster: ({ position }: { position?: string }) => (
    <div data-testid="toaster" data-position={position} />
  ),
}));

import { Toaster } from "./sonner";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function viewport(width: number) {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: q === "(max-width: 639px)" ? width <= 639 : false,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe("Toaster", () => {
  it("shows toasts at the top on a phone, clear of the bottom tab bar and buttons", () => {
    viewport(390);
    const { getByTestId } = render(<Toaster />);
    expect(getByTestId("toaster").getAttribute("data-position")).toBe("top-center");
  });

  it("keeps them at the bottom right on a desktop", () => {
    viewport(1440);
    const { getByTestId } = render(<Toaster />);
    expect(getByTestId("toaster").getAttribute("data-position")).toBe("bottom-right");
  });
});
