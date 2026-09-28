"use client";

import { useActionState } from "react";
import Link from "next/link";
import { athleteSignUp, athleteSignInWithGoogle } from "../actions";
import { GoogleIcon } from "../GoogleIcon";

export function AthleteSignUpForm() {
  const [state, formAction, pending] = useActionState(athleteSignUp, { error: "" });

  return (
    <div className="mx-auto w-full max-w-sm rounded-xl border border-white/10 bg-repone-gray p-8 shadow-xl">
      <h1 className="mb-1 text-xl font-bold text-white">Create your athlete account</h1>
      <p className="mb-6 text-sm text-white/60">
        Track your own Open-style workout history inside RepOne Platform.
      </p>

      {state.message ? (
        <p className="rounded-md border border-white/20 bg-black/40 p-3 text-sm text-white/80">{state.message}</p>
      ) : (
        <>
          <form action={athleteSignInWithGoogle}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-md border border-white/20 bg-white px-4 py-3 font-semibold text-black transition hover:bg-white/90"
            >
              <GoogleIcon />
              Continue with Google
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-white/40">
            <span className="h-px flex-1 bg-white/10" />
            or register with email
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
              className="rounded-md border border-white/20 bg-black/40 px-3 py-2 text-white outline-none focus:border-repone-red"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-white/80">
            Password
            <input
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="rounded-md border border-white/20 bg-black/40 px-3 py-2 text-white outline-none focus:border-repone-red"
            />
          </label>

          {state.error ? <p className="text-sm text-repone-red">{state.error}</p> : null}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 rounded-md bg-repone-red px-4 py-3 font-semibold uppercase tracking-wide text-white transition disabled:opacity-50"
          >
            {pending ? "Creating account…" : "Create Account"}
          </button>
          </form>
        </>
      )}

      <p className="mt-6 text-sm text-white/50">
        Already have an account?{" "}
        <Link href="/athlete/login" className="text-repone-red underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
