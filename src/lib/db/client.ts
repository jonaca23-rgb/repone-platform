"use client";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabasePublishableKey, supabaseUrl } from "./env";
import type { Database } from "./database.types";

/**
 * Browser Supabase client. Used by the Production Dashboard, overlays and the
 * realtime hooks to read and subscribe to changes so screens update without a
 * manual refresh.
 *
 * The browser never holds the signing key, so it asks /api/supabase-token for
 * a short-lived token, authenticated by the BetterAuth session cookie. A
 * cross-site page cannot read that response, so the route is safe as a GET.
 * Signed out (overlays on a streaming PC, the public leaderboard) the route
 * answers 401 and the client runs as anon, which RLS lets read public tables.
 */
let cached: { token: string; expiresAt: number } | null = null;
let pending: Promise<string | null> | null = null;

async function fetchToken(): Promise<string | null> {
  // Refresh a little early so a token never expires mid-request.
  if (cached && cached.expiresAt - 30_000 > Date.now()) return cached.token;

  // supabase-js may call this concurrently; share one in-flight request.
  pending ??= (async () => {
    try {
      const res = await fetch("/api/supabase-token", { cache: "no-store" });
      if (!res.ok) {
        cached = null;
        return null;
      }
      const { token, expiresIn } = (await res.json()) as { token: string; expiresIn: number };
      cached = { token, expiresAt: Date.now() + expiresIn * 1000 };
      return token;
    } catch {
      // Offline or the app restarting: ask as anon rather than fail the query.
      cached = null;
      return null;
    } finally {
      pending = null;
    }
  })();
  return pending;
}

export function createClient() {
  return createSupabaseClient<Database>(supabaseUrl(), supabasePublishableKey(), {
    accessToken: fetchToken,
  });
}
