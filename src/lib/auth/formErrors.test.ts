import { describe, expect, it } from "vitest";
import { signInErrorMessage, signUpErrorMessage } from "./formErrors";

describe("signInErrorMessage", () => {
  it("gives one message for every refusal, whatever the code", () => {
    expect(signInErrorMessage({ code: "INVALID_EMAIL_OR_PASSWORD", status: 401 })).toBe(
      "Email or password is incorrect.",
    );
    expect(signInErrorMessage({ code: "SOMETHING_ELSE", status: 400 })).toBe(
      "Email or password is incorrect.",
    );
  });

  it("says to wait when rate limited", () => {
    expect(signInErrorMessage({ status: 429 })).toMatch(/Too many attempts/);
  });
});

describe("signUpErrorMessage", () => {
  it("maps an existing email to a message that doesn't confirm it", () => {
    for (const code of ["USER_ALREADY_EXISTS", "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"]) {
      expect(signUpErrorMessage({ code, status: 422 })).toBe(
        "Couldn't create the account. If you already have one, sign in instead.",
      );
    }
  });

  it("explains a short password", () => {
    expect(signUpErrorMessage({ code: "PASSWORD_TOO_SHORT", status: 400 })).toBe(
      "Password must be at least 10 characters.",
    );
  });

  it("falls back to a generic message", () => {
    expect(signUpErrorMessage({ code: "FAILED_TO_CREATE_USER", status: 500 })).toBe(
      "Couldn't create the account. Please try again.",
    );
    expect(signUpErrorMessage(undefined)).toBe("Couldn't create the account. Please try again.");
  });

  it("says to wait when rate limited", () => {
    expect(signUpErrorMessage({ status: 429 })).toMatch(/Too many attempts/);
  });
});
