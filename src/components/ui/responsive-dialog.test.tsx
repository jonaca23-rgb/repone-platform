// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "./button";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "./responsive-dialog";

function mockViewport(width: number) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(max-width: 639px)" ? width <= 639 : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

function Example() {
  return (
    <ResponsiveDialog>
      <ResponsiveDialogTrigger>
        <Button>Open</Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Add sponsor</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody>Body</ResponsiveDialogBody>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ResponsiveDialog", () => {
  it("is a dialog on a desktop", async () => {
    mockViewport(1440);
    render(<Example />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(document.querySelector('[data-slot="dialog-content"]')).toBeTruthy();
    expect(document.querySelector('[data-slot="drawer-popup"]')).toBeNull();
  });

  it("is a drawer on a phone", async () => {
    mockViewport(390);
    render(<Example />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(document.querySelector('[data-slot="drawer-popup"]')).toBeTruthy();
    expect(screen.getByText("Add sponsor")).toBeTruthy();
  });
});
