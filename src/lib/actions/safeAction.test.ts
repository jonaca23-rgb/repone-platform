import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { fail, ok } from "@/lib/action-result";
import { NotAuthorizedError } from "@/lib/auth/guards";
import { ValidationError } from "@/lib/validation/form";
import { safeAction } from "./safeAction";

describe("safeAction", () => {
  it("passes a result through", async () => {
    expect(await safeAction(async () => ok())).toEqual({ ok: true });
    expect(await safeAction(async () => fail("Nope"))).toEqual({ ok: false, message: "Nope" });
  });

  it("turns a validation error into field errors", async () => {
    const result = await safeAction(async () => {
      throw new ValidationError("Name is required.", { name: ["Name is required."] });
    });
    expect(result).toEqual({
      ok: false,
      message: "Name is required.",
      fieldErrors: { name: ["Name is required."] },
    });
  });

  it("turns a refusal into a message", async () => {
    const result = await safeAction(async () => {
      throw new NotAuthorizedError("Only an admin or event director can do that.");
    });
    expect(result).toEqual({ ok: false, message: "Only an admin or event director can do that." });
  });

  it("rethrows anything unexpected, including Next's redirect", async () => {
    await expect(
      safeAction(async () => {
        throw new Error("db down");
      }),
    ).rejects.toThrow("db down");
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/admin;307;",
    });
    await expect(
      safeAction(async () => {
        throw redirect;
      }),
    ).rejects.toBe(redirect);
  });
});
