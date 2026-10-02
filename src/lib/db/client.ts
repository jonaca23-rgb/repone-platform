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
 * answers 401 once and the client runs as anon for the rest of the page,
 * which RLS lets read public tables.
 */
let cached: { token: string; expiresAt: number } | null = null;
let pending: Promise<string | null> | null = null;
// Set once the route answers 401. realtime-js re-reads the token on every
// heartbeat (25s), so without this every signed-out viewer (/live, each OBS
// overlay) would ask the route again every 25s. Nobody signs in or out
// without a full page load (src/lib/auth/identityChange.ts), which resets it.
let anonymous = false;

// A token is renewed this long before it expires. Background tabs may run
// timers only about once a minute, so the margin covers more than one
// throttled heartbeat and the token never lapses on a hidden tab.
const REFRESH_MARGIN_MS = 90_000;
// A hung response must not stall realtime subscribe() (which waits for the
// first token) or a query.
const FETCH_TIMEOUT_MS = 5_000;

async function fetchToken(): Promise<string | null> {
  if (anonymous) return null;
  if (cached && cached.expiresAt - REFRESH_MARGIN_MS > Date.now()) return cached.token;

  // supabase-js may call this concurrently; share one in-flight request.
  pending ??= (async () => {
    try {
      const res = await fetch("/api/supabase-token", {
        cache: "no-store",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (res.status === 401) {
        anonymous = true;
        cached = null;
        return null;
      }
      if (!res.ok) {
        // A server error is not an answer about who this is: ask again next time.
        cached = null;
        return null;
      }
      const { token, expiresIn } = (await res.json()) as { token: string; expiresIn: number };
      cached = { token, expiresAt: Date.now() + expiresIn * 1000 };
      return token;
    } catch {
      // Offline, timed out or the app restarting: ask as anon for this call
      // rather than fail the query, and try again on the next one.
      cached = null;
      return null;
    } finally {
      pending = null;
    }
  })();
  return pending;
}

/**
 * Forgets the cached token and the "signed out" answer. Called before the
 * hard navigation that follows a sign-in, sign-up or sign-out
 * (src/lib/auth/identityChange.ts), so no client keeps asking with the
 * previous person's identity.
 */
export function clearSupabaseToken() {
  cached = null;
  pending = null;
  anonymous = false;
}

export function createClient() {
  const client = createSupabaseClient<Database>(supabaseUrl(), supabasePublishableKey(), {
    accessToken: fetchToken,
  });

  // Realtime must join as the signed-in user, or RLS hides every row of a
  // private table (messages) and postgres_changes never fires. supabase-js
  // 2.112 hands `accessToken` to realtime-js, but only as a fire-and-forget
  // setAuth() that races the first subscribe(): the phx_join frame is built
  // and queued synchronously with no token (@supabase/phoenix Push.send), and
  // realtime-js only pushes a late token to channels already *joined*
  // (RealtimeClient._performAuth), then skips it after the join reply because
  // the value no longer changed. So a token that lands while the join is in
  // flight is never sent. Holding subscribe() until the first token is in
  // place puts it in the join payload. Later refreshes need nothing extra:
  // every heartbeat (25s) re-reads fetchToken, which renews 90s before expiry,
  // and realtime-js pushes the new token to joined channels.
  // Signed out, fetchToken resolves null and channels join as anon, as before.
  const authReady = fetchToken()
    .then((token) => (token ? client.realtime.setAuth(token) : undefined))
    .catch(() => undefined);
  const channel = client.channel.bind(client);
  client.channel = (name, opts) => {
    const ch = channel(name, opts);
    const subscribe = ch.subscribe.bind(ch);
    ch.subscribe = (callback, timeout) => {
      void authReady.then(() => {
        // The caller may have removed the channel while the token loaded.
        if (client.getChannels().includes(ch)) subscribe(callback, timeout);
      });
      return ch;
    };
    return ch;
  };

  return client;
}
