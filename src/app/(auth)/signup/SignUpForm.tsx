"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { GoogleButton, OAuthErrorNotice } from "@/components/auth/GoogleButton";
import { authClient } from "@/lib/auth/client";
import { signUpErrorMessage } from "@/lib/auth/formErrors";
import { useAuthForm } from "@/lib/auth/identityChange";

const INPUT =
  "rounded-md border border-white/20 bg-black/40 px-3 py-2 text-white outline-none focus:border-repone-red";

export function SignUpForm({ googleEnabled = false }: { googleEnabled?: boolean }) {
  // useAuthForm reads only email and password, so the name comes from a ref.
  const nameRef = useRef<HTMLInputElement>(null);
  const { error, pending, leaving, onSubmit } = useAuthForm(async (email, password) => {
    const name = nameRef.current?.value.trim() ?? "";
    const { error } = await authClient.signUp.email({ name, email, password, callbackURL: "/" });
    return error
      ? { error: signUpErrorMessage(error) }
      : { to: `/verify-email?email=${encodeURIComponent(email)}` };
  });
  const [googleFailed, setGoogleFailed] = useState(false);

  return (
    <>
      {googleFailed ? <OAuthErrorNotice /> : null}

      {googleEnabled ? (
        <div className="mb-4">
          <GoogleButton onFailure={() => setGoogleFailed(true)} />
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-white/80">
          Name
          <input
            ref={nameRef}
            name="name"
            type="text"
            required
            autoComplete="name"
            className={INPUT}
          />
        </label>
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
            minLength={10}
            autoComplete="new-password"
            className={INPUT}
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
        <Link href="/login" className="text-repone-red underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
