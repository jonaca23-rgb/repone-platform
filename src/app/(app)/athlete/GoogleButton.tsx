"use client";

import { authClient } from "@/lib/auth/client";
import { useState } from "react";
import { GoogleIcon } from "./GoogleIcon";

export function OAuthErrorNotice() {
  return (
    <p className="mb-4 rounded-md border border-repone-red/40 bg-repone-red/10 p-3 text-sm text-repone-red">
      Google sign-in didn&apos;t go through. Please try again, or use email and password.
    </p>
  );
}

/**
 * "Continue with Google" through BetterAuth. The forms render it only when
 * Google is configured (googleEnabled). BetterAuth sends the browser to Google
 * and its own /api/auth/callback/google handles the return, which lands on
 * callbackURL as a full page load. A failure to even start shows the notice.
 */
export function GoogleButton({ onFailure }: { onFailure: () => void }) {
  const [pending, setPending] = useState(false);

  async function start() {
    setPending(true);
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/athlete",
      });
      if (result.error) throw new Error(result.error.message);
    } catch {
      onFailure();
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={pending}
      className="flex w-full items-center justify-center gap-3 rounded-md border border-white/20 bg-white px-4 py-3 font-semibold text-black/80 transition hover:bg-white/90 disabled:opacity-50"
    >
      <GoogleIcon />
      Continue with Google
    </button>
  );
}
