// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OverlayLinks } from "./OverlayLinks";

afterEach(cleanup);

describe("OverlayLinks", () => {
  it("copies a source's full URL and says so", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(
      <OverlayLinks
        origin="https://x.test"
        floorId="f-1"
        sources={[
          { slug: "program", name: "Program", description: "Everything on air." },
          { slug: "timer", name: "Timer", description: "The clock." },
        ]}
      />,
    );
    await user.click(screen.getAllByRole("button", { name: "Copy URL" })[0]);
    expect(writeText).toHaveBeenCalledWith("https://x.test/overlay/f-1/program");
    expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /Preview/ })[0].getAttribute("href")).toBe(
      "https://x.test/overlay/f-1/program",
    );
  });
});
