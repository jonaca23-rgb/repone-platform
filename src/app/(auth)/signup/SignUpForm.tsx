"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { GoogleButton, OAuthErrorNotice } from "@/components/auth/GoogleButton";
import { authClient } from "@/lib/auth/client";
import { signUpErrorMessage } from "@/lib/auth/formErrors";
import { useAuthForm } from "@/lib/auth/identityChange";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
        <div className="grid gap-2">
          <Label htmlFor="name">Name</Label>
          <Input
            ref={nameRef}
            id="name"
            name="name"
            type="text"
            required
            autoComplete="name"
            className="h-11"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="h-11"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
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

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="submit" size="touch" disabled={pending || leaving} className="mt-2 w-full">
          {pending ? "Creating account…" : "Create Account"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center rounded-sm text-brand-text underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
