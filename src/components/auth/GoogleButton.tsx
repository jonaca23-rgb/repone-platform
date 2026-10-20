"use client";

import { authClient } from "@/lib/auth/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "./GoogleIcon";

/**
 * Why a Google sign-in failed, from BetterAuth's `error` code on the return
 * to errorCallbackURL. "account_not_linked" means the email already belongs
 * to a password account: BetterAuth keeps its secure default of linking only
 * to a verified local email.
 */
export type OAuthFailure = "account_not_linked" | "other";

export function OAuthErrorNotice({ failure = "other" }: { failure?: OAuthFailure }) {
  return (
    <p
      role="alert"
      className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
    >
      {failure === "account_not_linked"
        ? "This email already has a password account that isn't confirmed yet — confirm it from your inbox, then try Google again."
        : "Google sign-in didn't go through. Please try again, or use email and password."}
    </p>
  );
}

/**
 * "Continue with Google" through BetterAuth. The forms render it only when
 * Google is configured (googleEnabled). BetterAuth sends the browser to Google
 * and its own /api/auth/callback/google handles the return, which lands on
 * callbackURL as a full page load, or on errorCallbackURL with BetterAuth's
 * code appended (/login?error=oauth&error=account_not_linked). A
 * failure to even start shows the notice.
 */
export function GoogleButton({ onFailure }: { onFailure: () => void }) {
  const [pending, setPending] = useState(false);

  async function start() {
    setPending(true);
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
        errorCallbackURL: "/login?error=oauth",
      });
      if (result.error) throw new Error(result.error.message);
    } catch (e) {
      if (process.env.NODE_ENV !== "production") console.error("Google sign-in failed to start", e);
      onFailure();
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={start}
      disabled={pending}
      className="h-11 w-full gap-3 text-base"
    >
      <GoogleIcon />
      Continue with Google
    </Button>
  );
}
