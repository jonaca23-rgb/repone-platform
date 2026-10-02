"use client";

import Link from "next/link";
import { useState } from "react";
import { GoogleButton, OAuthErrorNotice, type OAuthFailure } from "@/components/auth/GoogleButton";
import { authClient } from "@/lib/auth/client";
import { isUnverified, signInErrorMessage } from "@/lib/auth/formErrors";
import { useAuthForm } from "@/lib/auth/identityChange";

const INPUT =
  "rounded-md border border-white/20 bg-black/40 px-3 py-2 text-white outline-none focus:border-repone-red";

export function LoginForm({
  oauthFailure,
  googleEnabled = false,
}: {
  oauthFailure?: OAuthFailure;
  googleEnabled?: boolean;
}) {
  // Everyone lands on "/", which routes each person to the modules their permissions open.
  const { error, pending, leaving, onSubmit } = useAuthForm(async (email, password) => {
    const { error } = await authClient.signIn.email({ email, password, callbackURL: "/" });
    if (isUnverified(error)) return { to: `/verify-email?email=${encodeURIComponent(email)}` };
    return error ? { error: signInErrorMessage(error) } : { to: "/" };
  });
  const [googleFailed, setGoogleFailed] = useState(false);

  return (
    <>
      {oauthFailure || googleFailed ? (
        <OAuthErrorNotice failure={googleFailed ? "other" : oauthFailure} />
      ) : null}

      {googleEnabled ? (
        <div className="mb-4">
          <GoogleButton onFailure={() => setGoogleFailed(true)} />
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-white/80">
          Email
          <input name="email" type="email" required autoComplete="email" className={INPUT} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-white/80">
          Password
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className={INPUT}
          />
        </label>

        {error ? <p className="text-sm text-repone-red">{error}</p> : null}

        <button
          type="submit"
          disabled={pending || leaving}
          className="mt-2 rounded-md bg-repone-red px-4 py-3 font-semibold uppercase tracking-wide text-white transition disabled:opacity-50"
        >
          {pending ? "Signing in…" : "Sign In"}
        </button>
      </form>

      <p className="mt-4 text-sm">
        <Link href="/forgot-password" className="text-white/60 underline hover:text-white">
          Forgot your password?
        </Link>
      </p>
      <p className="mt-2 text-sm text-white/50">
        No account?{" "}
        <Link href="/signup" className="text-repone-red underline">
          Create one
        </Link>
      </p>
    </>
  );
}
