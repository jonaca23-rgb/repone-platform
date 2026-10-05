// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
const toggleLike = vi.hoisted(() => vi.fn());
vi.mock("@/lib/actions/social", () => ({ toggleLike }));

import { LikeButton } from "./LikeButton";

afterEach(cleanup);

describe("LikeButton", () => {
  it("flips at once and puts itself back when the server says no", async () => {
    let answer: (r: unknown) => void = () => {};
    toggleLike.mockReturnValue(new Promise((r) => (answer = r)));
    render(
      <QueryClientProvider client={new QueryClient()}>
        <LikeButton athleteId="a" targetType="lift" targetId="l" count={2} likedByMe={false} />
      </QueryClientProvider>,
    );
    const button = screen.getByRole("button", { name: /Like/ });
    await userEvent.setup().click(button);
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.textContent).toContain("3");
    answer({ ok: false, message: "nope" });
    await waitFor(() => expect(button.getAttribute("aria-pressed")).toBe("false"));
    expect(button.textContent).toContain("2");
  });
});
