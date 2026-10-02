"use client";

import { type FormEvent, useState } from "react";
import { clearSupabaseToken } from "@/lib/db/client";

/**
 * Leaves the page with a full load after the signed-in person changes.
 *
 * A soft navigation keeps browser modules alive, including the cached Supabase
 * token in src/lib/db/client.ts and any open realtime channel. After sign-out,
 * or a sign-in on a shared device, those would keep asking as the previous
 * person. A full load discards them; the token is also cleared first in case
 * anything runs before the page unloads.
 */
export function leaveAfterIdentityChange(to: string) {
  clearSupabaseToken();
  window.location.assign(to);
}

/**
 * State for an email/password form that signs someone in or up through the
 * browser authClient. The request goes to BetterAuth's /api/auth/* routes,
 * which apply its rate limit (a server action calling auth.api would not).
 * `submit` resolves to where to go on success, or the message to show; on
 * success the form leaves with a full load.
 */
export function useAuthForm(
  submit: (email: string, password: string) => Promise<{ to: string } | { error: string }>,
) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [leaving, setLeaving] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }

    setPending(true);
    setError("");
    try {
      const result = await submit(email, password);
      if ("to" in result) {
        setLeaving(true);
        leaveAfterIdentityChange(result.to);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return { error, pending, leaving, onSubmit };
}
