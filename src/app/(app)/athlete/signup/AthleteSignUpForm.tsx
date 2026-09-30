"use client";

import { authClient } from "@/lib/auth/client";
import { signUpErrorMessage } from "@/lib/auth/formErrors";
import { useAuthForm } from "@/lib/auth/identityChange";
import { useState } from "react";
import Link from "next/link";
import { GoogleButton, OAuthErrorNotice } from "../GoogleButton";

export function AthleteSignUpForm({ googleEnabled = false }: { googleEnabled?: boolean }) {
  // Athlete accounts share the BetterAuth user table with staff, but signing up
  // only creates the user (and its bare profiles row); staff roles come only
  // from user_roles or event assignments. autoSignIn is on, so the new session
  // cookie is set by this response, and onboarding links the athletes row.
  const { error, pending, leaving, onSubmit } = useAuthForm(async (email, password) => {
    const { error } = await authClient.signUp.email({ email, password, name: email });
    return error ? { error: signUpErrorMessage(error) } : { to: "/athlete/onboarding" };
  });
  const [googleFailed, setGoogleFailed] = useState(false);

  return (
    <div className="mx-auto w-full max-w-sm rounded-xl border border-white/10 bg-repone-gray p-8 shadow-xl">
      <h1 className="mb-1 text-xl font-bold text-white">Create your athlete account</h1>
      <p className="mb-6 text-sm text-white/60">
        Track your own Open-style workout history inside RepOne Platform.
      </p>

      {googleFailed ? <OAuthErrorNotice /> : null}

      {googleEnabled ? (
        <div className="mb-4">
          <GoogleButton onFailure={() => setGoogleFailed(true)} />
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-white/80">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded-md border border-white/20 bg-black/40 px-3 py-2 text-white outline-none focus:border-repone-red"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-white/80">
          Password
          <input
            name="password"
            type="password"
            required
            minLength={10}
            autoComplete="new-password"
            className="rounded-md border border-white/20 bg-black/40 px-3 py-2 text-white outline-none focus:border-repone-red"
          />
        </label>

        {error ? <p className="text-sm text-repone-red">{error}</p> : null}

        <button
          type="submit"
          disabled={pending || leaving}
          className="mt-2 rounded-md bg-repone-red px-4 py-3 font-semibold uppercase tracking-wide text-white transition disabled:opacity-50"
        >
          {pending ? "Creating account…" : "Create Account"}
        </button>
      </form>

      <p className="mt-6 text-sm text-white/50">
        Already have an account?{" "}
        <Link href="/athlete/login" className="text-repone-red underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
