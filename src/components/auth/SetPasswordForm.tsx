"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { resetErrorMessage } from "@/lib/auth/formErrors";

/** Saves a new password from a reset or invitation link's token, then goes to `redirectTo`. */
export function SetPasswordForm({
  token,
  redirectTo,
  submitLabel,
}: {
  token: string;
  redirectTo: string;
  submitLabel: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("confirm") ?? "")) {
      setError("The passwords don't match.");
      return;
    }

    setPending(true);
    setError("");
    try {
      const { error } = await authClient.resetPassword({ newPassword: password, token });
      if (error) {
        setError(
          error.code === "PASSWORD_TOO_SHORT"
            ? "Password must be at least 10 characters."
            : resetErrorMessage(error),
        );
        setPending(false);
        return;
      }
      router.replace(redirectTo);
    } catch {
      setError(resetErrorMessage(null));
      setPending(false);
    }
  }

  const input =
    "rounded-md border border-white/20 bg-black/40 px-3 py-2 text-white outline-none focus:border-repone-red";
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm text-white/80">
        New password
        <input
          name="password"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          className={input}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-white/80">
        Confirm password
        <input
          name="confirm"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          className={input}
        />
      </label>

      {error ? <p className="text-sm text-repone-red">{error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md bg-repone-red px-4 py-3 font-semibold uppercase tracking-wide text-white transition disabled:opacity-50"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
