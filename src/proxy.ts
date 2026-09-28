import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { supabaseAnonKey, supabaseUrl } from "@/lib/db/env";

// Refreshes the Supabase auth session cookie on every request so server
// components/actions always see a valid session. Overlay and public
// leaderboard routes don't need auth at all (RLS grants them public read).
// Every authenticated route group needs this, though: `lib/db/server.ts`'s
// client can only WRITE a refreshed cookie from a Server Action or Route
// Handler (Next.js forbids it during a plain page render), so a page like
// /scorekeeper/[floorId] that a scorekeeper leaves open for a multi-hour
// heat schedule would otherwise get logged out mid-event the moment the
// access token expires, with no middleware pass to silently refresh it.
// Found during a pre-production pass (2026-09-17): the matcher covered
// /admin and /dashboard (added on day one) but not /scorekeeper (added
// 2026-09-07) or /athlete (added 2026-09-13), both added later without this
// list being revisited. /commentator (added 2026-09-20) is the same kind of
// screen a staff member leaves open for a whole event, so it's added here
// from day one instead of repeating that mistake.
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/dashboard/:path*",
    "/scorekeeper/:path*",
    "/athlete/:path*",
    "/commentator/:path*",
    // /producer added alongside the rest of the event-scoped RBAC work
    // (0024_event_role_assignments.sql) — same "long-lived open tab" shape
    // as the other staff screens, so it needs the same session refresh.
    "/producer/:path*",
  ],
};
