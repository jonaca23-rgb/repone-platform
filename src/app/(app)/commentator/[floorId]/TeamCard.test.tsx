// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TeamCard } from "./TeamCard";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("TeamCard", () => {
  it("lists two members who share a name, without a key clash", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <TeamCard
        lane={{
          laneNumber: 3,
          athleteId: null,
          teamId: "t1",
          name: "Aprieta Duo",
          affiliate: null,
          members: ["Ana Cruz", "Ana Cruz"],
        }}
      />,
    );
    expect(screen.getAllByText("Ana Cruz")).toHaveLength(2);
    expect(consoleError).not.toHaveBeenCalled();
  });
});
