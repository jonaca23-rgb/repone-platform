import Link from "next/link";
import { ModuleMenu } from "@/components/app/ModuleMenu";
import { SkipLink } from "@/components/app/SkipLink";
import { AthleteBottomNav } from "./AthleteBottomNav";

/**
 * The athlete portal, built for a phone: a one-line header (logo, the
 * module and account menu) and a bottom tab bar under md; from md up the
 * same three links sit in the header. `signedIn` means an athlete profile
 * is linked: before onboarding there is nothing to navigate to, so no nav.
 * Dark from here down while the (app) root body is still light.
 */
export function AthleteShell({
  signedIn,
  unreadCount,
  userId,
  children,
}: {
  signedIn: boolean;
  unreadCount: number;
  /** The signed-in user, for the live unread count. Required for the nav. */
  userId?: string;
  children: React.ReactNode;
}) {
  const showNav = signedIn && userId !== undefined;
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SkipLink />
      <header className="sticky top-0 z-20 border-b border-border bg-card pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 pr-[max(0.5rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))]">
          <Link
            href="/"
            className="flex min-h-11 shrink-0 items-center rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local static asset in public/, not optimizable-domain content */}
            <img
              src="/repone-logo.png"
              alt="RepOne home"
              width={472}
              height={240}
              className="h-6 w-auto"
            />
          </Link>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 md:justify-between">
            {showNav ? <AthleteBottomNav unreadCount={unreadCount} userId={userId} /> : null}
            <ModuleMenu current="athlete" compact />
          </div>
        </div>
      </header>
      <main
        id="main"
        tabIndex={-1}
        className={`mx-auto w-full max-w-3xl flex-1 px-4 pt-6 outline-hidden sm:px-6 ${
          showNav ? "pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-6" : "pb-6"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
