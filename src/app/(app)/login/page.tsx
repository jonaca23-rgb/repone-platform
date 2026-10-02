"use client";

import { authClient } from "@/lib/auth/client";
import { signInErrorMessage } from "@/lib/auth/formErrors";
import { useAuthForm } from "@/lib/auth/identityChange";

export default function LoginPage() {
  // Every role lands on /admin first; its layout sends non-admins to their own screen.
  const { error, pending, leaving, onSubmit } = useAuthForm(async (email, password) => {
    const { error } = await authClient.signIn.email({ email, password });
    return error ? { error: signInErrorMessage(error) } : { to: "/admin" };
  });

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
              autoComplete="current-password"
              className="rounded-md border border-white/20 bg-black/40 px-3 py-2 text-white outline-none focus:border-repone-red"
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
      </div>
    </div>
  );
}
