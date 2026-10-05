// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MessageThread } from "./MessageThread";

const scroll = vi.fn();
beforeEach(() => {
  scroll.mockReset();
  Element.prototype.scrollIntoView = scroll;
});
afterEach(cleanup);

const msg = (id: string, fromMe = false) => ({
  id,
  body: `message ${id}`,
  createdAt: "2026-10-04T12:00:00Z",
  fromMe,
});

describe("MessageThread", () => {
  it("opens at the newest message and follows new ones", () => {
    const view = render(<MessageThread messages={[msg("1"), msg("2")]} counterpartName="Maria" />);
    expect(scroll).toHaveBeenCalledTimes(1);
    view.rerender(
      <MessageThread messages={[msg("1"), msg("2"), msg("3", true)]} counterpartName="Maria" />,
    );
    expect(scroll).toHaveBeenCalledTimes(2);
    view.rerender(
      <MessageThread messages={[msg("1"), msg("2"), msg("3", true)]} counterpartName="Maria" />,
    );
    expect(scroll).toHaveBeenCalledTimes(2);
  });

  it("says hello when empty", () => {
    render(<MessageThread messages={[]} counterpartName="Maria" />);
    expect(screen.getByText("No messages yet. Say hello.")).toBeTruthy();
  });
});
