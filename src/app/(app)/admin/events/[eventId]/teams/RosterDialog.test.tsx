// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
const addTeamMember = vi.hoisted(() => vi.fn());
vi.mock("@/lib/actions/teams", () => ({
  addTeamMember,
  removeTeamMember: vi.fn(),
  setTeamCaptain: vi.fn(),
}));

import { RosterDialog } from "./RosterDialog";

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
  });

  it("says so when nobody matches", async () => {
    renderDialog();
    await userEvent.setup().type(screen.getByRole("searchbox", { name: "Find an athlete" }), "zz");
    expect(screen.getByText("No athlete matches “zz”.")).toBeTruthy();
  });
});
