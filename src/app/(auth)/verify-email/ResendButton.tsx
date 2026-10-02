"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { TOO_MANY } from "@/lib/auth/formErrors";

export function ResendButton({ email }: { email: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function resend() {
    setPending(true);
    setMessage("");
    try {
      const { error } = await authClient.sendVerificationEmail({ email, callbackURL: "/" });
      if (!error) setMessage("Sent — check your inbox (and spam).");
      else if (error.status === 429) setMessage(TOO_MANY);
      else setMessage("Couldn't send the email. Please try again in a minute.");
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={resend}
        disabled={pending}
        className="w-full rounded-md border border-white/20 px-4 py-3 font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/40 hover:text-white disabled:opacity-50"
      >
        {pending ? "Sending…" : "Resend the email"}
      </button>
      {message ? (
        <p role="status" className="mt-3 text-sm text-white/70">
          {message}
        </p>
      ) : null}
    </div>
  );
}
