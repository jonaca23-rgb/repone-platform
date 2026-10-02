import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/session";
import { resolveHome } from "@/lib/auth/modules";
import { userModules } from "@/lib/auth/userModules";
import { AccountMenu } from "@/components/AccountMenu";

/**
 * `/` — the public landing page for visitors, and the start page (one card
 * per module the person can open) for anyone signed in.
 */
export default async function HomePage() {
  const session = await getAuthSession();
  if (!session) return <PublicLanding />;
  const home = resolveHome(await userModules());
  if ("redirect" in home) redirect(home.redirect);
  const { modules, offerAthleteProfile } = home.start;

  return (
    <div className="flex min-h-screen flex-col bg-repone-black text-repone-white">
      <header className="flex items-center justify-between px-6 py-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- local static asset */}
        <img src="/repone-logo.png" alt="RepOne" className="h-9 w-auto" width={472} height={240} />
        <AccountMenu />
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
        <h1 className="text-2xl font-bold">Hi, {session.name || session.email}</h1>
        {modules.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {modules.map((m) => (
              <Link
                key={m.kind}
                href={m.href}
                className="rounded-xl border border-white/10 bg-repone-gray p-6 hover:border-repone-red"
              >
                <p className="text-lg font-bold uppercase tracking-wide">{m.label}</p>
                <p className="mt-1 text-sm text-white/60">{m.detail}</p>
              </Link>
            ))}
          </div>
        ) : null}
        {offerAthleteProfile ? (
          <div
            className={
              modules.length
                ? "rounded-xl border border-dashed border-white/20 p-6"
                : "flex flex-col items-center gap-4 py-16 text-center"
            }
          >
            <Link href="/athlete/onboarding" className="control-btn control-btn-red px-8">
              Create my athlete profile
            </Link>
            {modules.length === 0 ? (
              <p className="text-sm text-white/50">Invited as staff? Use the link in your email.</p>
            ) : null}
          </div>
        ) : null}
      </main>
    </div>
  );
}

function PublicLanding() {
  return (
    <div className="flex min-h-screen flex-col bg-repone-black text-repone-white">
      <header className="flex justify-end px-6 py-4">
        <Link
          href="/login"
          className="text-xs font-bold uppercase tracking-wide text-white/50 hover:text-white"
        >
          Sign In
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-16">
        {/* eslint-disable-next-line @next/next/no-img-element -- local static asset in public/, not optimizable-domain content */}
        <img
          src="/repone-live-logo.png"
          alt="RepOne Live"
          className="h-24 w-auto sm:h-28"
          width={375}
          height={240}
        />
        <p className="max-w-md text-center text-white/60">
          Sports data, scoring, and broadcast graphics for RepOneLive competitions.
        </p>
        <div className="flex w-full max-w-xs flex-col gap-4 px-4 sm:max-w-none sm:w-auto sm:flex-row sm:px-0">
          <Link href="/live" className="control-btn control-btn-red px-8">
            Live Leaderboard
          </Link>
          <Link
            href="/login"
            className="control-btn control-btn-outline border-white/30 !bg-transparent !text-white px-8"
          >
            Sign in
          </Link>
        </div>
      </main>
    </div>
  );
}
