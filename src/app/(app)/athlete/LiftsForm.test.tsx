// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
const saveMyLifts = vi.hoisted(() => vi.fn());
vi.mock("@/lib/actions/myLifts", () => ({ saveMyLifts }));

import { LiftsForm } from "./LiftsForm";

afterEach(cleanup);

describe("LiftsForm", () => {
  it("shows the failure inline and keeps what was typed", async () => {
    saveMyLifts.mockResolvedValue({
      ok: false,
      message: "Enter at least one lift or time to save.",
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <LiftsForm
          lifts={[
            { lift: "deadlift", label: "Deadlift", timeLift: false, defaultValue: "" },
            { lift: "run_5k", label: "5K run", timeLift: true, defaultValue: "" },
          ]}
        />
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Deadlift (lbs)"), "225");
    await user.click(screen.getByRole("button", { name: "Save Lifts" }));
    expect(await screen.findByText("Enter at least one lift or time to save.")).toBeTruthy();
    expect(screen.getByLabelText("Deadlift (lbs)")).toHaveProperty("value", "225");
  });
});
