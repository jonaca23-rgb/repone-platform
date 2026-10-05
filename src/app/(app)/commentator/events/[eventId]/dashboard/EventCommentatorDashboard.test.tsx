// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// Like the real client, the stand-in keeps per-floor state in useState.
vi.mock("@/app/(app)/commentator/[floorId]/CommentatorClient", () => ({
  CommentatorClient: ({ initialBroadcastState }: { initialBroadcastState: { label: string } }) => {
    const [shown] = useState(initialBroadcastState.label);
    return <p>Showing {shown}</p>;
  },
}));

import { EventCommentatorDashboard } from "./EventCommentatorDashboard";

const floor = (id: string, label: string) =>
  ({
    floorId: id,
    floorName: id,
    venueName: "Main",
    heats: [],
    initialBroadcastState: { label },
  }) as never;

afterEach(cleanup);

describe("EventCommentatorDashboard", () => {
  it("shows the picked floor's own state", async () => {
    render(
      <EventCommentatorDashboard
        floors={[floor("A", "floor A"), floor("B", "floor B")]}
        detailsByAthleteId={{}}
      />,
    );
    expect(screen.getByText("Showing floor A")).toBeTruthy();
    await userEvent.setup().click(screen.getByRole("button", { name: "Main — B" }));
    expect(screen.getByText("Showing floor B")).toBeTruthy();
  });
});
