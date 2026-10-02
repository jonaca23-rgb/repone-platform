import { describe, expect, it } from "vitest";
import { isUnverified, resetErrorMessage, signInErrorMessage, signUpErrorMessage } from "./formErrors";

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

  it("says the email couldn't be sent when the server fails without a code", () => {
    expect(signUpErrorMessage({ status: 500 })).toBe(
      "Couldn't send the confirmation email. Please try again in a minute.",
    );
  });

  it("says to wait when rate limited", () => {
    expect(signUpErrorMessage({ status: 429 })).toMatch(/Too many attempts/);
  });
});

describe("unverified and reset errors", () => {
  it("an unverified sign-in asks to verify, never 'incorrect password'", () => {
    const e = { status: 403, code: "EMAIL_NOT_VERIFIED" };
    expect(isUnverified(e)).toBe(true);
    expect(signInErrorMessage(e)).toBe("Confirm your email first — we just sent you a new link.");
  });
  it("an expired or used link says so", () => {
    expect(resetErrorMessage({ code: "INVALID_TOKEN" })).toBe("This link has expired or was already used.");
    expect(resetErrorMessage({ status: 500 })).toBe("Couldn't save the password. Please try again.");
  });
});
