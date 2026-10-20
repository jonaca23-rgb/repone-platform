/**
 * What the sign-in and sign-up forms show for a refusal from BetterAuth's
 * /api/auth/* routes. The message is chosen from the error code or HTTP
 * status only; BetterAuth's own message is never shown, because for an
 * existing email it would reveal which addresses have accounts.
 */
export type AuthClientError = { code?: string; status?: number } | null | undefined;

export const TOO_MANY = "Too many attempts. Wait a few seconds and try again.";

/** An unverified password account: BetterAuth refuses the sign-in (only when the password is right) and resends the link. */
export function isUnverified(error: AuthClientError): boolean {
  return error?.code === "EMAIL_NOT_VERIFIED";
}

export function signInErrorMessage(error: AuthClientError): string {
  if (error?.status === 429) return TOO_MANY;
  if (isUnverified(error)) return "Confirm your email first — we just sent you a new link.";
  return "Email or password is incorrect.";
}

export function resetErrorMessage(error: AuthClientError): string {
  if (error?.code === "INVALID_TOKEN") return "This link has expired or was already used.";
  return "Couldn't save the password. Please try again.";
}

export function signUpErrorMessage(error: AuthClientError): string {
  if (error?.status === 429) return TOO_MANY;
  // The account is created before the confirmation email is sent, and BetterAuth
  // awaits the send: an unreachable mail server surfaces as a bare 500 with no
  // error code (FAILED_TO_CREATE_USER, the other 500, carries one).
  if (error?.status === 500 && !error.code) {
    return "Couldn't send the confirmation email. Please try again in a minute.";
  }
  switch (error?.code) {
    case "PASSWORD_TOO_SHORT":
      return "Password must be at least 10 characters.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "Couldn't create the account. If you already have one, sign in instead.";
    default:
      return "Couldn't create the account. Please try again.";
  }
}
