// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
const addTeamMember = vi.hoisted(() => vi.fn());
vi.mock("@/lib/actions/teams", () => ({
  addTeamMember,
  removeTeamMember: vi.fn(),
  setTeamCaptain: vi.fn(),
}));

import { RosterDialog } from "./RosterDialog";

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

const team = { id: "t1", name: "Aprieta Duo", size: 4, captainId: null, roster: [] };
const available = [
  { id: "a1", label: "Maria Rivera (CrossFit Bayamón)" },
  { id: "a2", label: "Sofía Delgado" },
  { id: "a3", label: "Camila Ortiz (Box Ponce)" },
];

function renderDialog() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RosterDialog eventId="e1" team={team} available={available} />
    </QueryClientProvider>,
  );
}

describe("RosterDialog", () => {
  it("finds an athlete by name or affiliate, accents aside, and adds them in one tap", async () => {
    addTeamMember.mockResolvedValue({ ok: true });
    renderDialog();
    const user = userEvent.setup();
    const search = screen.getByRole("searchbox", { name: "Find an athlete" });

    await user.type(search, "ponce");
    expect(screen.queryByRole("button", { name: /Maria Rivera/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Add Camila Ortiz (Box Ponce)" })).toBeTruthy();

    await user.clear(search);
    await user.type(search, "sofia");
    await user.click(screen.getByRole("button", { name: "Add Sofía Delgado" }));
    await waitFor(() => expect(addTeamMember).toHaveBeenCalledOnce());
    const [eventId, teamId, fd] = addTeamMember.mock.calls[0];
    expect([eventId, teamId, (fd as FormData).get("athlete_id")]).toEqual(["e1", "t1", "a2"]);
    // Ready for the next teammate: the search is cleared and has the focus back.
    await waitFor(() => expect(document.activeElement).toBe(search));
    expect(search).toHaveProperty("value", "");
  });

  it("adds the only match when Enter is pressed in the search", async () => {
    addTeamMember.mockResolvedValue({ ok: true });
    renderDialog();
    await userEvent
      .setup()
      .type(screen.getByRole("searchbox", { name: "Find an athlete" }), "ortiz{Enter}");
    await waitFor(() => expect(addTeamMember).toHaveBeenCalledOnce());
    expect((addTeamMember.mock.calls[0][2] as FormData).get("athlete_id")).toBe("a3");
  });

  it("doesn't add anyone on Enter in an empty search", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RosterDialog eventId="e1" team={team} available={[available[0]]} />
      </QueryClientProvider>,
    );
    await userEvent
      .setup()
      .type(screen.getByRole("searchbox", { name: "Find an athlete" }), "{Enter}");
    expect(addTeamMember).not.toHaveBeenCalled();
  });

  it("clears a failed add's message once the search changes", async () => {
    addTeamMember.mockResolvedValue({
      ok: false,
      message: "That athlete is already on another team in this event.",
    });
    renderDialog();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Add Sofía Delgado" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    await user.type(screen.getByRole("searchbox", { name: "Find an athlete" }), "m");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("lists the first 50 matches and asks for more letters past that", () => {
    const many = Array.from({ length: 120 }, (_, i) => ({ id: `x${i}`, label: `Athlete ${i}` }));
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RosterDialog eventId="e1" team={team} available={many} />
      </QueryClientProvider>,
    );
    expect(screen.getAllByRole("button", { name: /^Add Athlete/ })).toHaveLength(50);
    expect(screen.getByText("Showing 50 of 120. Keep typing to narrow it down.")).toBeTruthy();
  });

  it("says so when nobody matches", async () => {
    renderDialog();
    await userEvent.setup().type(screen.getByRole("searchbox", { name: "Find an athlete" }), "zz");
    expect(screen.getByText("No athlete matches “zz”.")).toBeTruthy();
  });
});
