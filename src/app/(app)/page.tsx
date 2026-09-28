import Link from "next/link";

/**
 * Public landing page. Only two entry points are offered here — Live
 * Leaderboard (no login, same as the OBS overlay routes — see
 * live/layout.tsx) and Athlete Portal (its own login/signup one click in,
 * for /athlete/login) — per Jonathan's request. Staff/organizer sign-in is
 * a small link in the upper right rather than a third equally-weighted
 * button, matching the same "Organizer Sign In" placement already used on
 * the Live Leaderboard's own header.
 */
export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-repone-black text-repone-white">
      <header className="flex justify-end px-6 py-4">
        <Link href="/login" className="text-xs font-bold uppercase tracking-wide text-white/50 hover:text-white">
          Sign In
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-16">
        {/* eslint-disable-next-line @next/next/no-img-element -- local static asset in public/, not optimizable-domain content */}
        <img src="/repone-live-logo.png" alt="RepOne Live" className="h-24 w-auto sm:h-28" width={375} height={240} />
        <p className="max-w-md text-center text-white/60">
          Sports data, scoring, and broadcast graphics for RepOneLive competitions.
        </p>
        <div className="flex w-full max-w-xs flex-col gap-4 px-4 sm:max-w-none sm:w-auto sm:flex-row sm:px-0">
          <Link href="/live" className="control-btn control-btn-red px-8">
            Live Leaderboard
          </Link>
          <Link href="/athlete" className="control-btn control-btn-outline border-white/30 !bg-transparent !text-white px-8">
            Athlete Portal
          </Link>
        </div>
      </main>
    </div>
  );
}
