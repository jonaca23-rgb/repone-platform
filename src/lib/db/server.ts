import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * Server-side Supabase client for Server Components, Server Actions, and Route
 * Handlers. Reads/writes the auth cookie so RLS policies see the signed-in user.
 *
 * NOTE: intentionally untyped — see the matching comment in client.ts. Swap in
 * `createServerClient<Database>` once database.types.ts is replaced with real
 * `supabase gen types` output that includes Relationships metadata.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component render (not an action/route handler) —
          // safe to ignore because middleware refreshes the session cookie anyway.
        }
      },
    },
  });
}
