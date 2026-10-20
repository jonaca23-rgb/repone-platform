// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionSwitch } from "./ActionSwitch";

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn() } }));

afterEach(cleanup);

describe("ActionSwitch", () => {
  it("flips back and says why when the action returns a failure", async () => {
    const message = "Another active sponsor already holds this sponsor's exclusive category.";
    render(
      <ActionSwitch
        checked={false}
        action={async () => ({ ok: false, message })}
        label="Hoka active"
      />,
    );
    const toggle = screen.getByRole("switch", { name: "Hoka active" });
    await userEvent.click(toggle);
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(message));
    expect(toggle.getAttribute("aria-checked")).toBe("false");
  });
});
