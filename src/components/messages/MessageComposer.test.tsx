// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
const sendMessage = vi.hoisted(() => vi.fn());
vi.mock("@/lib/actions/messages", () => ({ sendMessage }));

import { MessageComposer } from "./MessageComposer";

beforeAll(() => {
  if (!HTMLFormElement.prototype.requestSubmit) {
    HTMLFormElement.prototype.requestSubmit = function () {
      this.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    };
  }
});
afterEach(() => {
  cleanup();
  sendMessage.mockReset();
});

function setup() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MessageComposer recipientId="u-2" recipientName="Maria" />
    </QueryClientProvider>,
  );
  return { user: userEvent.setup(), box: screen.getByLabelText("Message to Maria") };
}

describe("MessageComposer", () => {
  it("sends, says it's sending, and clears", async () => {
    let answer: (r: unknown) => void = () => {};
    sendMessage.mockReturnValue(new Promise((r) => (answer = r)));
    const { user, box } = setup();
    await user.type(box, "Hi");
    await user.click(screen.getByRole("button", { name: /Send/ }));
    expect(screen.getByRole("button", { name: /Sending…/ })).toHaveProperty("disabled", true);
    expect(sendMessage.mock.calls[0][0]).toBe("u-2");
    expect((sendMessage.mock.calls[0][1] as FormData).get("body")).toBe("Hi");
    answer({ ok: true });
    await waitFor(() => expect(box).toHaveProperty("value", ""));
  });

  it("keeps the text and says why on failure", async () => {
    sendMessage.mockResolvedValue({ ok: false, message: "You can't message this person." });
    const { user, box } = setup();
    await user.type(box, "Hi");
    await user.click(screen.getByRole("button", { name: /Send/ }));
    expect(await screen.findByText("You can't message this person.")).toBeTruthy();
    expect(box).toHaveProperty("value", "Hi");
  });

  it("sends on Enter and adds a line on Shift+Enter", async () => {
    sendMessage.mockResolvedValue({ ok: true });
    const { user, box } = setup();
    await user.type(box, "Line one{Shift>}{Enter}{/Shift}two");
    expect(sendMessage).not.toHaveBeenCalled();
    expect(box).toHaveProperty("value", "Line one\ntwo");
    await user.type(box, "{Enter}");
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
  });

  it("keeps what was typed while a message was sending", async () => {
    let answer: (r: unknown) => void = () => {};
    sendMessage.mockReturnValue(new Promise((r) => (answer = r)));
    const { user, box } = setup();
    await user.type(box, "First");
    await user.click(screen.getByRole("button", { name: /Send/ }));
    await user.type(box, " and more");
    answer({ ok: true });
    await waitFor(() => expect(box).toHaveProperty("value", "and more"));
  });
});
