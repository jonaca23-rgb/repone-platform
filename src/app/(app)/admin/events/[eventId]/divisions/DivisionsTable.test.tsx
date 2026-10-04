// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DivisionsTable } from "./DivisionsTable";

vi.mock("@/lib/actions/divisions", () => ({
  createDivision: vi.fn(),
  deleteDivision: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.stubGlobal("matchMedia", (q: string) => ({
  matches: false,
  media: q,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));

afterEach(cleanup);

const rows = [
  { id: "d-1", name: "Rx Male" },
  { id: "d-2", name: "Scaled Female" },
];

function ui(data: typeof rows) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <DivisionsTable eventId="ev-1" rows={data} />
    </QueryClientProvider>
  );
}

describe("DivisionsTable", () => {
  it("keeps a row's open dialog when the server sends fresh rows", async () => {
    const { rerender } = render(ui(rows));
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Actions for Scaled Female" }));
    await user.click(await screen.findByRole("menuitem", { name: "Remove division" }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    // What router.refresh() does after another row's save: same rows, new objects.
    rerender(ui(rows.map((r) => ({ ...r }))));
    expect(screen.queryByRole("alertdialog")).toBeTruthy();
  });
});
