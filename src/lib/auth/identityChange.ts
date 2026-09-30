"use client";

import { useEffect } from "react";
import { clearSupabaseToken } from "@/lib/db/client";

/**
 * Leaves the page with a full load after the signed-in person changes.
 *
 * A server action's redirect() is a soft navigation: browser modules survive
 * it, including the cached Supabase token in src/lib/db/client.ts and any open
 * realtime channel. After sign-out, or a sign-in on a shared device, those
 * would keep asking as the previous person. A full load discards them; the
 * token is also cleared first in case anything runs before the page unloads.
 */
export function leaveAfterIdentityChange(to: string) {
  clearSupabaseToken();
  window.location.assign(to);
}

/** For sign-in and sign-up forms: follows the action's `redirectTo` with a full load. */
export function useLeaveAfterIdentityChange(redirectTo: string | undefined) {
  useEffect(() => {
    if (redirectTo) leaveAfterIdentityChange(redirectTo);
  }, [redirectTo]);
}
