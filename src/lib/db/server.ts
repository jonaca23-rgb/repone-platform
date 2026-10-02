import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { getAuthSession } from "@/lib/auth/session";
import { mintSupabaseToken } from "@/lib/supabase/token";
import { supabasePublishableKey, supabaseUrl } from "./env";
import type { Database } from "./database.types";

/**
 * Server-side Supabase client for Server Components, Server Actions, and Route
 * Handlers.
 *
 * Every request carries a short-lived token minted from the BetterAuth
 * session, so RLS sees auth.uid() as the signed-in user. With no session it
 * carries no token and runs as anon, which is what the public leaderboard,
 * /live and the overlays read with.
 *
 * The `auth` namespace of this client is unavailable by design: supabase-js
 * disables it when accessToken is set. Identity comes from
 * src/lib/auth/session.ts.
 */
export async function createClient() {
  const token = await requestToken();

  return createSupabaseClient<Database>(supabaseUrl(), supabasePublishableKey(), {
    accessToken: async () => token,
  });
}

/** One token per request: pages and actions build several clients. */
const requestToken = cache(async (): Promise<string | null> => {
  const session = await getAuthSession();
  return session ? mintSupabaseToken({ userId: session.userId, email: session.email }) : null;
});
