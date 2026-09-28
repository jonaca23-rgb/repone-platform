"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { athleteSignIn, athleteSignInWithGoogle } from "../actions";
import { GoogleIcon } from "../GoogleIcon";

// First screen an athlete sees is three plain choices — Google, Email &
// Password, Create Account — rather than a full form up front. The email/
// password fields only mount once "Sign in with Email & Password" is
// clicked, per Jonathan's request; useState here is just local UI toggle
// state (nothing persisted), so it doesn't change this page's otherwise
// server-first, mostly-zero-JS approach.
export function AthleteLoginForm({ oauthError = false }: { oauthError?: boolean }) {
  const [state, formAction, pending] = useActionState(athleteSignIn, { error: "" });
  const [showEmailForm, setShowEmailForm] = useState(false);

  return (
    <div className="mx-auto w-full max-w-sm rounded-xl border border-white/10 bg-repone-gray p-8 shadow-xl">
      <h1 className="mb-1 text-xl font-bold text-white">Athlete Sign In</h1>
      <p className="mb-6 text-sm text-white/60">Sign in to your RepOne athlete account.</p>

      {oauthError ? (
        <p className="mb-4 rounded-md border border-repone-red/40 bg-repone-red/10 p-3 text-sm text-repone-red">
          Google sign-in didn&apos;t go through. Please try again, or sign in below.
        </p>
      ) : null}

      <form action={athleteSignInWithGoogle}>
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-md border border-white/20 bg-white px-4 py-3 font-semibold text-black transition hover:bg-white/90"
        >
          <GoogleIcon />
          Continue with Google
        </button>
      </form>

      {showEmailForm ? (
        <>
          <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-white/40">
            <span className="h-px flex-1 bg-white/10" />
            or
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <form action={formAction} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm text-white/80">
              Email
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                autoFocus
                className="rounded-md border border-white/20 bg-black/40 px-3 py-2 text-white outline-none focus:border-repone-red"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-white/80">
              Password
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="rounded-md border border-white/20 bg-black/40 px-3 py-2 text-white outline-none focus:border-repone-red"
              />
            </label>

            {state.error ? <p className="text-sm text-repone-red">{state.error}</p> : null}

            <button
              type="submit"
              disabled={pending}
              className="mt-2 rounded-md bg-repone-red px-4 py-3 font-semibold uppercase tracking-wide text-white transition disabled:opacity-50"
            >
              {pending ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setShowEmailForm(true)}
          className="mt-3 w-full rounded-md border border-white/20 px-4 py-3 font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/40 hover:text-white"
        >
          Sign in with Email &amp; Password
        </button>
      )}

      <p className="mt-6 text-sm text-white/50">
        New here?{" "}
        <Link href="/athlete/signup" className="text-repone-red underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
