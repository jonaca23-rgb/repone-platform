// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pickTab } from "@/lib/tabs";
import { LinkTabs } from "./LinkTabs";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const TABS = [
  { value: "profile", label: "Profile" },
  { value: "performance", label: "Performance" },
  { value: "competitions", label: "Competitions" },
] as const;

afterEach(cleanup);

describe("LinkTabs", () => {
  it("marks the current tab and links the others by ?tab=", () => {
    render(
      <LinkTabs tabs={TABS} current="performance" label="Athlete sections">
        <p>Lifts</p>
      </LinkTabs>,
    );
    expect(screen.getByRole("tab", { name: "Performance" }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(screen.getByRole("tab", { name: "Profile" }).getAttribute("href")).toBe("?tab=profile");
    expect(screen.getByText("Lifts")).toBeTruthy();
  });

  it("falls back to the first tab for an unknown one", () => {
    expect(pickTab(TABS, "nope")).toBe("profile");
    expect(pickTab(TABS, "competitions")).toBe("competitions");
    expect(pickTab(TABS, undefined)).toBe("profile");
  });
});
