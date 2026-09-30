"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "./env";
import type { Database } from "./database.types";

/**
 * Browser Supabase client. Used by the Production Dashboard and overlay pages
 * to subscribe to Realtime changes on `broadcast_state` (and related tables)
 * so graphics update without a manual refresh.
 */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey());
}
