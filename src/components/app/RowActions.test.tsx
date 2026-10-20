// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RowActions } from "./RowActions";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

afterEach(cleanup);

describe("RowActions", () => {
  it("names the primary button for its row when the row asks", () => {
    render(
      <RowActions
        label="Payment actions for Maria Rivera"
        primary={{ label: "Mark paid", ariaLabel: "Mark Maria Rivera paid", onSelect: vi.fn() }}
      />,
    );
    expect(
      screen.getAllByRole("button", { name: "Mark Maria Rivera paid" }).length,
    ).toBeGreaterThan(0);
  });
});
