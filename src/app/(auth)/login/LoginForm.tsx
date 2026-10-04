"use client";

import Link from "next/link";
import { useState } from "react";
import { GoogleButton, OAuthErrorNotice, type OAuthFailure } from "@/components/auth/GoogleButton";
import { authClient } from "@/lib/auth/client";
import { isUnverified, signInErrorMessage } from "@/lib/auth/formErrors";
import { useAuthForm } from "@/lib/auth/identityChange";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({
  oauthFailure,
  googleEnabled = false,
}: {
  oauthFailure?: OAuthFailure;
  googleEnabled?: boolean;
}) {
  // Everyone lands on "/", which routes each person to the modules their permissions open.
  const { error, pending, leaving, onSubmit } = useAuthForm(async (email, password) => {
    const { error } = await authClient.signIn.email({ email, password, callbackURL: "/" });
    if (isUnverified(error)) return { to: `/verify-email?email=${encodeURIComponent(email)}` };
    return error ? { error: signInErrorMessage(error) } : { to: "/" };
  });
  const [googleFailed, setGoogleFailed] = useState(false);

  return (
    <>
      {oauthFailure || googleFailed ? (
        <OAuthErrorNotice failure={googleFailed ? "other" : oauthFailure} />
      ) : null}

      {googleEnabled ? (
        <div className="mb-4">
          <GoogleButton onFailure={() => setGoogleFailed(true)} />
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="inline-flex min-h-11 items-center rounded-sm text-sm text-brand-text underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
            >
              Forgot your password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="h-11"
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="submit" size="touch" disabled={pending || leaving} className="mt-2 w-full">
          {pending ? "Signing in…" : "Sign In"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        No account?{" "}
        <Link
          href="/signup"
          className="inline-flex min-h-11 items-center rounded-sm text-brand-text underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
        >
          Create one
        </Link>
      </p>
    </>
  );
}
