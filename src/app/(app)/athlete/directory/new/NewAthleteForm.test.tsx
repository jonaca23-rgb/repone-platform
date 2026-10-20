// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push }) }));
const createAthleteFromPortal = vi.hoisted(() => vi.fn());
vi.mock("@/lib/actions/social", () => ({ createAthleteFromPortal }));

import { NewAthleteForm } from "./NewAthleteForm";

afterEach(cleanup);

describe("NewAthleteForm", () => {
  it("stays disabled after success, so a second tap can't resubmit while it navigates", async () => {
    createAthleteFromPortal.mockResolvedValue({
      ok: true,
      data: { href: "/athlete/directory/n1" },
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <NewAthleteForm />
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("First name"), "Ana");
    await user.type(screen.getByLabelText("Last name"), "Lopez");
    await user.type(screen.getByLabelText("Email"), "ana@example.com");
    await user.click(screen.getByRole("button", { name: "Add Athlete" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/athlete/directory/n1"));
    expect(screen.getByRole("button", { name: /Add/ })).toHaveProperty("disabled", true);
  });
});
