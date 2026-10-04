// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/lib/action-result";
import { fieldErrorsOf, useServerAction } from "@/lib/use-server-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormAlert } from "./FormAlert";
import { FormDialog } from "./FormDialog";
import { FormField } from "./FormField";
import { SubmitButton } from "./SubmitButton";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.stubGlobal("matchMedia", (q: string) => ({
  matches: false,
  media: q,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));

function NameForm({
  action,
  close,
  initial,
}: {
  action: (fd: FormData) => Promise<ActionResult>;
  close: () => void;
  initial: string;
}) {
  const m = useServerAction(action, { success: "Saved", toastErrors: false, onSuccess: close });
  const errors = fieldErrorsOf(m.error);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        m.mutate(new FormData(e.currentTarget));
      }}
    >
      <FormField label="Name" name="name" errors={errors?.name}>
        {(control) => <Input {...control} defaultValue={initial} />}
      </FormField>
      <FormAlert error={m.error} />
      <SubmitButton pending={m.isPending} pendingLabel="Saving…">
        Save
      </SubmitButton>
    </form>
  );
}

function setup(action: (fd: FormData) => Promise<ActionResult>, initial = "Hoka") {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <FormDialog trigger={<Button>Edit</Button>} title="Edit sponsor">
        {(close) => <NameForm action={action} close={close} initial={initial} />}
      </FormDialog>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

afterEach(cleanup);

describe("FormDialog", () => {
  it("closes after a successful save", async () => {
    const user = setup(async () => ({ ok: true }));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("stays open and shows the field error on failure", async () => {
    const user = setup(async () => ({
      ok: false,
      message: "Name is required.",
      fieldErrors: { name: ["Name is required."] },
    }));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("Name is required."),
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByLabelText("Name").getAttribute("aria-invalid")).toBe("true");
  });

  it("shows a form-level failure", async () => {
    const user = setup(async () => ({
      ok: false,
      message: "Another active sponsor already holds that category.",
    }));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(screen.getByText("Another active sponsor already holds that category.")).toBeTruthy(),
    );
  });

  it("reopens with the current values, not a draft", async () => {
    const user = setup(async () => ({ ok: true }));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Draft");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Hoka");
  });
});
