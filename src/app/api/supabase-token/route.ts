import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { TOKEN_TTL_SECONDS, mintSupabaseToken } from "@/lib/supabase/token";

/**
 * A short-lived Supabase token for the signed-in browser (src/lib/db/client.ts).
 * 401 when signed out: the browser client then runs as anon.
 */
export async function GET() {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ token: null }, { status: 401 });

  return NextResponse.json(
    {
      token: await mintSupabaseToken({ userId: session.userId, email: session.email }),
      expiresIn: TOKEN_TTL_SECONDS,
    },
    // A bearer token must never be cached by anything between here and the tab.
    { headers: { "Cache-Control": "no-store" } },
  );
}
