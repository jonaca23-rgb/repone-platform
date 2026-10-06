// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const subs = vi.hoisted(() => [] as Array<Record<string, unknown>>);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/db/client", () => ({
  createClient: () => ({
    channel: () => {
      const ch = {
        on: (_t: string, config: Record<string, unknown>) => {
          subs.push(config);
          return ch;
        },
        subscribe: () => ch,
      };
      return ch;
    },
    removeChannel: () => {},
  }),
}));

import { ThreadLiveRefresh } from "./ThreadLiveRefresh";

afterEach(() => {
  cleanup();
  subs.length = 0;
});

describe("ThreadLiveRefresh", () => {
  it("refreshes on new messages to me and from me, not on read receipts", () => {
    render(<ThreadLiveRefresh myUserId="u-1" />);
    expect(subs).toEqual([
      expect.objectContaining({
        event: "INSERT",
        table: "messages",
        filter: "recipient_id=eq.u-1",
      }),
      expect.objectContaining({ event: "INSERT", table: "messages", filter: "sender_id=eq.u-1" }),
    ]);
  });
});
