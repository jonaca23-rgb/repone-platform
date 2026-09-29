import Link from "next/link";

// Deliberately NO auth check here (unlike admin/dashboard/scorekeeper's
// layouts) — this is the public, unauthenticated leaderboard area: athletes
// and spectators reach it with no account, same as the OBS overlay routes.
// Every table it reads already has a "public read" RLS policy (see
// getEventLiveContext's header comment), so no schema change was needed.
export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-repone-black text-repone-white">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-4">
          {/* Public visitors have no admin session, so "Home" here means the
              site's public landing page ("/"), not /admin like the
              authenticated sections' Home buttons. */}
          <Link
            href="/"
            className="text-xs font-bold uppercase tracking-wide text-white/50 hover:text-white"
          >
            🏠 Home
          </Link>
          <Link href="/live" className="shrink-0 hover:opacity-80">
            {/* eslint-disable-next-line @next/next/no-img-element -- local static asset in public/, not optimizable-domain content */}
            <img
              src="/repone-live-logo.png"
              alt="RepOne Live"
              className="h-9 w-auto sm:h-10"
              width={375}
              height={240}
            />
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <a
            href="https://youtube.com/@reponelive?si=FH5VMRdLD3DO-C2g"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-repone-red px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-repone-red/80"
          >
            ▶ Watch Live on YouTube
          </a>
          <Link
            href="/login"
            className="text-xs font-bold uppercase tracking-wide text-white/50 hover:text-white"
          >
            Organizer Sign In
          </Link>
        </div>
      </div>
      {children}
    </div>
  );
}
