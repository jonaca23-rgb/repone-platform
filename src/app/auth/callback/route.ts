import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";

// Handshake step for "Continue with Google" (see athleteSignInWithGoogle in
// (app)/athlete/actions.ts): Supabase's Google provider redirects the
// browser here with a one-time ?code= after the athlete approves Google's
// consent screen. signInWithOAuth() on its own only sends someone to
// Google — it never creates a session by itself — so this is the step that
// actually signs the athlete in, by exchanging that code (plus the PKCE
// verifier cookie signInWithOAuth already set) for a real session.
//
// Lives outside the (app) route group, with no /athlete prefix, because
// this exact path is registered once as the redirect target in the
// Supabase dashboard's Google provider settings — it's Supabase's own
// callback target, not a page an athlete ever navigates to directly. Not
// added to src/proxy.ts's matcher either: that matcher exists to refresh an
// already-established session on a long-lived page (see its own comment),
// not to intercept a one-time redirect that authenticates itself.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/athlete";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // No code (athlete declined the Google consent screen) or the exchange
  // itself failed — back to the login form with a plain-language notice
  // instead of a bare error page.
  return NextResponse.redirect(`${origin}/athlete/login?error=oauth`);
}
