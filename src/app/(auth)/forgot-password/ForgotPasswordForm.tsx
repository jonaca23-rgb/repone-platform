"use client";

import { type FormEvent, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { TOO_MANY } from "@/lib/auth/formErrors";

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    if (!email) return;

    setPending(true);
    setError("");
    try {
      const { error } = await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      });
      // The answer never depends on whether the address has an account.
      if (error?.status === 429) setError(TOO_MANY);
      else setMessage("If that email has an account, we sent a link to reset the password.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (message)
    return (
      <p role="status" className="text-sm text-white/80">
        {message}
      </p>
    );

  return (
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

      {error ? <p className="text-sm text-repone-red">{error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md bg-repone-red px-4 py-3 font-semibold uppercase tracking-wide text-white transition disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
