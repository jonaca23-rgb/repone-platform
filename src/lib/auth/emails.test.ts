import { describe, expect, it } from "vitest";
import { existingAccountEmail, isInvitationLink, passwordLinkEmail } from "./emails";

const base = "http://localhost:3200/api/auth/reset-password/tok";

describe("passwordLinkEmail", () => {
  it("uses invitation copy only for an /invite link", () => {
    expect(isInvitationLink(`${base}?callbackURL=%2Finvite`)).toBe(true);
    expect(isInvitationLink(`${base}?callbackURL=%2Freset-password`)).toBe(false);
    expect(isInvitationLink(base)).toBe(false);
    expect(passwordLinkEmail({ to: "a@b.co", url: `${base}?callbackURL=%2Finvite`, organization: "R1" }).subject).toBe("You're invited to RepOne");
    expect(passwordLinkEmail({ to: "a@b.co", url: `${base}?callbackURL=%2Freset-password`, organization: null }).subject).toBe("Reset your RepOne password");
  });
});

describe("existingAccountEmail", () => {
  it("links to sign-in and forgot-password, escaped", () => {
    const mail = existingAccountEmail({ to: "a@b.co", loginUrl: "http://x/login?a=1&b=2", forgotUrl: "http://x/forgot-password" });
    expect(mail.subject).toBe("You already have a RepOne account");
    expect(mail.text).toContain("http://x/login?a=1&b=2");
    expect(mail.html).toContain("http://x/login?a=1&amp;b=2");
    expect(mail.html).toContain('href="http://x/forgot-password"');
  });
});
