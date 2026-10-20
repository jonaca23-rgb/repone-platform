"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { TOO_MANY } from "@/lib/auth/formErrors";
import { Button } from "@/components/ui/button";

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
      <Button
        type="button"
        variant="outline"
        size="touch"
        onClick={resend}
        disabled={pending}
        className="w-full"
      >
        {pending ? "Sending…" : "Resend the email"}
      </Button>
      {message ? (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
    </div>
  );
}
