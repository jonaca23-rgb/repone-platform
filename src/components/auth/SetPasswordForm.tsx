"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { resetErrorMessage } from "@/lib/auth/formErrors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          aria-describedby="password-hint"
          className="h-11"
        />
        <p id="password-hint" className="text-sm text-muted-foreground">
          At least 10 characters.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirm">Confirm password</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          className="h-11"
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="touch" disabled={pending} className="mt-2 w-full">
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
