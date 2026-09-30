"use client";

import { useLeaveAfterIdentityChange } from "@/lib/auth/identityChange";
import { useActionState } from "react";
import { signIn } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, { error: "" });
  useLeaveAfterIdentityChange(state.redirectTo);

  return (
    <div className="flex min-h-screen items-center justify-center bg-repone-black px-4">
      <div className="w-full max-w-sm rounded-xl border border-white/10 bg-repone-gray p-8 shadow-xl">
        {/* eslint-disable-next-line @next/next/no-img-element -- local static asset in public/, not optimizable-domain content */}
        <img
          src="/repone-logo.png"
          alt="RepOne"
          className="mb-3 h-10 w-auto"
          width={472}
          height={240}
        />
        <p className="mb-6 text-sm text-white/60">Sign in to Admin / Production Dashboard</p>

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
              autoComplete="current-password"
              className="rounded-md border border-white/20 bg-black/40 px-3 py-2 text-white outline-none focus:border-repone-red"
            />
          </label>

          {state.error ? <p className="text-sm text-repone-red">{state.error}</p> : null}

          <button
            type="submit"
            disabled={pending || Boolean(state.redirectTo)}
            className="mt-2 rounded-md bg-repone-red px-4 py-3 font-semibold uppercase tracking-wide text-white transition disabled:opacity-50"
          >
            {pending ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
