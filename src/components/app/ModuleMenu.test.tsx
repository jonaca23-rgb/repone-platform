// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModuleMenuView } from "./ModuleMenu";

// ModuleMenu.tsx loads the session on the server; its server-only import throws in jsdom.
vi.mock("server-only", () => ({}));

afterEach(cleanup);

describe("ModuleMenuView", () => {
  it("opens, lists modules with the current one marked, and closes on Escape", async () => {
    const user = userEvent.setup();
    render(
      <ModuleMenuView
        name="Ada Admin"
        email="admin@repone.test"
        items={[
          { href: "/", label: "Home", icon: "home", current: false },
          { href: "/admin", label: "Admin", detail: "RepOneLive", icon: "admin", current: true },
        ]}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Ada Admin/ }));
    expect(screen.getByRole("menuitem", { name: /Admin/ }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(screen.getByRole("menuitem", { name: /Sign out/ })).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
