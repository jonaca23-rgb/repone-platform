// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/lib/action-result";
import { fieldErrorsOf, useServerAction } from "./use-server-action";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));

function Harness({
  action,
  toastErrors,
}: {
  action: (n: number) => Promise<ActionResult>;
  toastErrors?: boolean;
}) {
  const m = useServerAction(action, { success: "Saved", toastErrors });
  return (
    <div>
      <button type="button" onClick={() => m.mutate(1)}>
        Go
      </button>
      <p>{m.isPending ? "pending" : "idle"}</p>
      <p>{fieldErrorsOf(m.error)?.name?.[0] ?? ""}</p>
    </div>
  );
}

function renderWith(ui: React.ReactNode) {
  const client = new QueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useServerAction", () => {
  it("toasts success and refreshes", async () => {
    renderWith(<Harness action={async () => ({ ok: true })} />);
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Saved"));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("toasts a failure and does not refresh", async () => {
    renderWith(<Harness action={async () => ({ ok: false, message: "Nope" })} />);
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Nope"));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("keeps field errors and stays quiet when the form shows them", async () => {
    renderWith(
      <Harness
        toastErrors={false}
        action={async () => ({
          ok: false,
          message: "Name is required.",
          fieldErrors: { name: ["Name is required."] },
        })}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    await waitFor(() => expect(screen.getByText("Name is required.")).toBeTruthy());
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("toasts the server's own success words when the caller gives none", async () => {
    function Bare() {
      const m = useServerAction(async () => ({ ok: true as const, message: "Invitation sent." }));
      return (
        <button type="button" onClick={() => m.mutate(undefined)}>
          Invite
        </button>
      );
    }
    renderWith(<Bare />);
    await userEvent.click(screen.getByRole("button", { name: "Invite" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Invitation sent."));
  });

  it("still reports a failure after the form that started it has closed", async () => {
    let resolve!: (r: ActionResult) => void;
    const action = () =>
      new Promise<ActionResult>((r) => {
        resolve = r;
      });
    const { unmount } = renderWith(<Harness toastErrors={false} action={action} />);
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    unmount();
    resolve({ ok: false, message: "Another active sponsor already holds that category." });
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Another active sponsor already holds that category.",
      ),
    );
  });

  it("ignores a second submit while pending", async () => {
    let resolve!: (r: ActionResult) => void;
    const action = vi.fn(
      () =>
        new Promise<ActionResult>((r) => {
          resolve = r;
        }),
    );
    renderWith(<Harness action={action} />);
    const go = screen.getByRole("button", { name: "Go" });
    await userEvent.click(go);
    await userEvent.click(go);
    resolve({ ok: true });
    await waitFor(() => expect(screen.getByText("idle")).toBeTruthy());
    expect(action).toHaveBeenCalledTimes(1);
  });
});
