// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OperatorShell } from "./OperatorShell";

// ModuleMenu loads the session on the server; it is not what is under test.
vi.mock("@/components/app/ModuleMenu", () => ({ ModuleMenu: () => null }));

afterEach(cleanup);

describe("OperatorShell", () => {
  it("links the module label to /<module> by default", () => {
    render(
      <OperatorShell module="producer" moduleLabel="Producer">
        <p>page</p>
      </OperatorShell>,
    );
    expect(screen.getByRole("link", { name: "Producer" }).getAttribute("href")).toBe("/producer");
  });

  it("links the module label to moduleHref when given", () => {
    render(
      <OperatorShell module="producer" moduleLabel="Production" moduleHref="/dashboard">
        <p>page</p>
      </OperatorShell>,
    );
    expect(screen.getByRole("link", { name: "Production" }).getAttribute("href")).toBe(
      "/dashboard",
    );
  });
});
