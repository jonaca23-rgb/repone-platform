// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// A stand-in that, like the real board, keeps per-floor state in useState.
vi.mock("@/app/(app)/dashboard/[floorId]/DashboardClient", () => ({
  DashboardClient: ({ initialBroadcastState }: { initialBroadcastState: { label: string } }) => {
    const [shown] = useState(initialBroadcastState.label);
    return <p>Showing {shown}</p>;
  },
}));

import { EventProducerProduction } from "./EventProducerProduction";

const floor = (id: string, label: string) =>
  ({
    floorId: id,
    floorName: id,
    venueName: "Main",
    heats: [],
    initialBroadcastState: { label },
  }) as never;

afterEach(cleanup);

describe("EventProducerProduction", () => {
  it("shows the picked floor's own state, not the previous floor's", async () => {
    render(
      <EventProducerProduction
        eventId="ev"
        eventName="Aprieta"
        floors={[floor("A", "floor A"), floor("B", "floor B")]}
        sponsors={[]}
      />,
    );
    expect(screen.getByText("Showing floor A")).toBeTruthy();
    await userEvent.setup().click(screen.getByRole("button", { name: "Main — B" }));
    expect(screen.getByText("Showing floor B")).toBeTruthy();
  });
});
