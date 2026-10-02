import Link from "next/link";
import { getAthleteSessionContext } from "@/lib/auth/session";
import { AccountMenu } from "@/components/AccountMenu";
import { getUnreadCount } from "@/lib/db/messages";
import { MessagesNavLink } from "@/components/MessagesNavLink";

/**
 * Shell for the athlete self-service portal — a separate identity space from
 * /admin (see 0010_athlete_open_log.sql). Deliberately does NOT redirect
 * unauthenticated visitors here: /athlete/signup and /athlete/login must be
 * reachable with no session, so each page below does its own redirect check
 * instead of a blanket one at the layout level.
 */
export default async function AthleteLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAthleteSessionContext();
  const unreadCount = ctx?.athleteId ? await getUnreadCount(ctx.userId) : 0;

  return (
    <div className="flex min-h-screen flex-col bg-repone-black">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-white/10 px-4 py-4 text-repone-white sm:px-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link href="/" className="shrink-0 hover:opacity-80">
            {/* eslint-disable-next-line @next/next/no-img-element -- local static asset in public/, not optimizable-domain content */}
            <img
              src="/repone-live-logo.png"
              alt="RepOne"
              className="h-9 w-auto sm:h-10"
              width={375}
              height={240}
            />
          </Link>
          <p className="text-sm font-bold uppercase tracking-wide text-white/60">Athlete Portal</p>
          {ctx?.athleteId ? (
            <nav className="flex items-center gap-4 text-sm font-semibold text-white/70">
              <Link href="/athlete" className="hover:text-white">
                Home
              </Link>
              <Link href="/athlete/directory" className="hover:text-white">
                Athletes
              </Link>
              <MessagesNavLink
                href="/athlete/messages"
                userId={ctx.userId}
                initialUnread={unreadCount}
              />
            </nav>
          ) : null}
        </div>
        {ctx ? (
          <div className="flex items-center gap-4 text-sm">
            {ctx.firstName ? (
              <span className="text-white/60">
                {ctx.firstName} {ctx.lastName}
              </span>
            ) : null}
            <AccountMenu />
          </div>
        ) : (
          <Link href="/" className="text-sm text-white/60 hover:text-white">
            ← Back to Home
          </Link>
        )}
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
