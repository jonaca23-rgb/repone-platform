"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * Browser Supabase client. Used by the Production Dashboard and overlay pages
 * to subscribe to Realtime changes on `broadcast_state` (and related tables)
 * so graphics update without a manual refresh.
 *
 * NOTE: intentionally untyped (no <Database> generic). Our hand-authored
 * database.types.ts (see that file's header comment) only models `Row` shapes
 * and omits the Insert/Update/Relationships metadata Supabase's generated
 * types normally include, which the query builder needs to type joined
 * (`table(nested)`) selects correctly. Once real generated types replace it,
 * re-add `<Database>` here for full autocomplete/type-checking.
 */
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabaseAnonKey());
}
