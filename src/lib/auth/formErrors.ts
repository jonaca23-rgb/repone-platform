/**
 * What the sign-in and sign-up forms show for a refusal from BetterAuth's
 * /api/auth/* routes. The message is chosen from the error code or HTTP
 * status only; BetterAuth's own message is never shown, because for an
 * existing email it would reveal which addresses have accounts.
 */
export type AuthClientError = { code?: string; status?: number } | null | undefined;

const TOO_MANY = "Too many attempts. Wait a few seconds and try again.";

export function signInErrorMessage(error: AuthClientError): string {
  if (error?.status === 429) return TOO_MANY;
  return "Email or password is incorrect.";
}

export function signUpErrorMessage(error: AuthClientError): string {
  if (error?.status === 429) return TOO_MANY;
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
