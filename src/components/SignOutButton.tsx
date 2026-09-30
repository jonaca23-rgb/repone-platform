"use client";

import { useTransition } from "react";
import { leaveAfterIdentityChange } from "@/lib/auth/identityChange";

/**
 * Ends the BetterAuth session, then leaves with a full load so no browser
 * state (cached Supabase token, realtime channels) outlives the sign-out.
 */
export function SignOutButton({
  action,
  redirectTo,
  className,
}: {
  action: () => Promise<void>;
  redirectTo: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      onClick={() =>
        startTransition(async () => {
          await action();
          leaveAfterIdentityChange(redirectTo);
        })
      }
    >
      Sign out
    </button>
  );
}
