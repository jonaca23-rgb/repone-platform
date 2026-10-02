// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmAction } from "./ConfirmAction";

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

afterEach(cleanup);

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
});
