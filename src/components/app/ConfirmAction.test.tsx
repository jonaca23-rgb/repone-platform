// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Component, type ReactNode } from "react";
import { ConfirmAction } from "./ConfirmAction";

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn() } }));

/** Stands in for Next's redirect boundary, which catches the rethrown redirect. */
class Boundary extends Component<{ children: ReactNode }, { caught: unknown }> {
  state = { caught: null as unknown };
  static getDerivedStateFromError(caught: unknown) {
    return { caught };
  }
  render() {
    return this.state.caught ? <p>redirected</p> : this.props.children;
  }
}

function setup() {
  const onConfirm = vi.fn().mockResolvedValue(undefined);
  render(
    <ConfirmAction
      trigger="Remove"
      title="Remove Heat 3?"
      description="Its lanes and results are deleted."
      confirmLabel="Remove heat"
      onConfirm={onConfirm}
    />,
  );
  return { onConfirm, user: userEvent.setup() };
}

afterEach(() => {
  cleanup();
  toastError.mockClear();
});

describe("ConfirmAction", () => {
  it("does nothing until confirmed", async () => {
    const { onConfirm, user } = setup();
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(screen.getByText("Its lanes and results are deleted.")).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it("cancel closes without running the action", async () => {
    const { onConfirm, user } = setup();
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it("confirm runs the action exactly once, even on a double click", async () => {
    const { onConfirm, user } = setup();
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await user.dblClick(screen.getByRole("button", { name: "Remove heat" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
  it("stays open and can be retried when the action rejects", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error("Nope"));
    render(
      <ConfirmAction
        trigger="Remove"
        title="Remove Heat 3?"
        description="d"
        confirmLabel="Remove heat"
        onConfirm={onConfirm}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await user.click(screen.getByRole("button", { name: "Remove heat" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Remove heat" }).hasAttribute("disabled")).toBe(
        false,
      ),
    );
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Remove heat" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });
  it("leaves a redirect to Next instead of toasting it as a failure", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/admin;307;",
    });
    const onConfirm = vi.fn().mockRejectedValue(redirect);
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <Boundary>
        <ConfirmAction
          trigger="Delete event"
          title="Delete Aprieta?"
          description="d"
          confirmLabel="Delete event"
          onConfirm={onConfirm}
        />
      </Boundary>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Delete event" }));
    await user.click(screen.getByRole("button", { name: "Delete event" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText("redirected")).toBeTruthy());
    expect(toastError).not.toHaveBeenCalled();
    quiet.mockRestore();
  });

  it("toasts an ordinary failure", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error("Nope"));
    render(
      <ConfirmAction
        trigger="Remove"
        title="Remove Heat 3?"
        description="d"
        confirmLabel="Remove heat"
        onConfirm={onConfirm}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await user.click(screen.getByRole("button", { name: "Remove heat" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Nope"));
  });
});
