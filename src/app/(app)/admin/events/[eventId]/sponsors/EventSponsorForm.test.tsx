// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
const updateEventSponsorship = vi.hoisted(() => vi.fn());
vi.mock("@/lib/actions/eventSponsorships", () => ({
  addEventSponsorship: vi.fn(),
  updateEventSponsorship,
}));

import { EditEventSponsorForm } from "./EventSponsorForm";

beforeAll(() => {
  // Radix asks for pointer capture, scrolling and ResizeObserver, which jsdom lacks.
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
afterEach(cleanup);

const packages = [
  { id: "p1", name: "Logo Sponsor", display_duration_seconds: 8, display_weight: 1, active: true },
  {
    id: "p2",
    name: "Title Sponsor",
    display_duration_seconds: 20,
    display_weight: 5,
    active: true,
  },
];
const sponsorship = {
  id: "es-1",
  sponsorName: "Hoka",
  packageId: "p1",
  exclusive: false,
  durationOverride: null,
  weightOverride: null,
};

function renderForm() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <EditEventSponsorForm
        eventId="e1"
        sponsorship={sponsorship}
        packages={packages}
        close={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

describe("EditEventSponsorForm", () => {
  it("shows the chosen package's duration and weight as the overrides' defaults", async () => {
    renderForm();
    const user = userEvent.setup();
    expect(screen.getByLabelText("Seconds on screen")).toHaveProperty("placeholder", "8");
    await user.click(screen.getByRole("combobox", { name: "Package" }));
    await user.click(await screen.findByRole("option", { name: "Title Sponsor" }));
    expect(screen.getByLabelText("Seconds on screen")).toHaveProperty("placeholder", "20");
    expect(screen.getByLabelText("Weight")).toHaveProperty("placeholder", "5");
  });

  it("says why exclusivity was refused, beside the checkbox", async () => {
    const message =
      "Only a sponsor with a category can hold it exclusively. Give the sponsor a category first.";
    updateEventSponsorship.mockResolvedValue({
      ok: false,
      message,
      fieldErrors: { category_exclusive: [message] },
    });
    renderForm();
    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox", { name: /exclusively/ }));
    await user.click(screen.getByRole("button", { name: "Save sponsorship" }));
    expect(await screen.findByText(message)).toBeTruthy();
  });
});
