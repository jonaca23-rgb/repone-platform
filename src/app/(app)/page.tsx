import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
import { EmptyState } from "@/components/app/EmptyState";
import { MODULE_ICONS } from "@/components/app/moduleIcons";
import { ModuleMenu } from "@/components/app/ModuleMenu";
import { SkipLink } from "@/components/app/SkipLink";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthSession } from "@/lib/auth/session";
import { resolveHome, type ModuleKind } from "@/lib/auth/modules";
import { userModules } from "@/lib/auth/userModules";

export const metadata: Metadata = { title: { absolute: "RepOne" } };

/** What each module is for, one line on its start-page card. */
const MODULE_PURPOSE: Record<ModuleKind, string> = {
  admin: "Events, athletes, payments and staff",
  producer: "Run the broadcast",
  scorekeeper: "Enter results on the floor",
  commentator: "Lanes, athletes and standings at a glance",
  athlete: "Your check-in, lifts and messages",
};

/**
 * `/` — the public landing page for visitors, and the start page (one card
 * per module the person can open) for anyone signed in. Both set their own
 * dark background while the (app) root body is still light.
 */
export default async function HomePage() {
  const session = await getAuthSession();
  if (!session) return <PublicLanding />;
  const home = resolveHome(await userModules());
  if ("redirect" in home) redirect(home.redirect);
  const { modules, offerAthleteProfile } = home.start;

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background text-foreground">
      <SkipLink />
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-3 px-4">
          <Image
            src="/repone-logo.png"
            alt="RepOne"
            width={472}
            height={240}
            priority
            className="h-7 w-auto"
          />
          <ModuleMenu current={null} compact />
        </div>
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10 outline-hidden"
      >
        <h1 className="font-display text-3xl font-bold tracking-wide text-balance uppercase">
          Hi, {session.name || session.email}
        </h1>
        {modules.length > 0 ? (
          <>
            <ul className="grid gap-4 sm:grid-cols-2">
              {modules.map((m) => {
                const Icon = MODULE_ICONS[m.kind];
                return (
                  <li key={m.kind}>
                    <Link
                      href={m.href}
                      className="group block h-full rounded-xl focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-hidden"
                    >
                      <Card className="h-full transition-colors group-hover:bg-muted">
                        <CardHeader className="grid-cols-[auto_1fr] items-start gap-x-4 gap-y-1">
                          <Icon className="row-span-3 mt-0.5 size-6 text-brand-text" aria-hidden />
                          <CardTitle className="font-display text-xl font-bold tracking-wide uppercase">
                            {m.label}
                          </CardTitle>
                          <CardDescription className="text-foreground">
                            {MODULE_PURPOSE[m.kind]}
                          </CardDescription>
                          {m.detail ? (
                            <CardDescription className="truncate">{m.detail}</CardDescription>
                          ) : null}
                        </CardHeader>
                      </Card>
                    </Link>
                  </li>
                );
              })}
            </ul>
            {offerAthleteProfile ? (
              <div className="flex flex-wrap items-center gap-3">
                <Button asChild variant="outline" className="h-11 gap-2">
                  <Link href="/athlete/onboarding">
                    <UserPlus aria-hidden />
                    Create my athlete profile
                  </Link>
                </Button>
                <p className="text-sm text-muted-foreground">
                  Competing too? Add your own profile.
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <EmptyState
            icon={UserPlus}
            title="Nothing to open yet"
            description="Create your athlete profile to check in and track your lifts. Invited as staff? Use the link in your email."
            action={
              <Button asChild size="touch" className="mt-2">
                <Link href="/athlete/onboarding">Create my athlete profile</Link>
              </Button>
            }
          />
        )}
      </main>
    </div>
  );
}

function PublicLanding() {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background text-foreground">
      <main
        id="main"
        tabIndex={-1}
        className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 outline-hidden"
      >
        <h1 className="sr-only">RepOne Live</h1>
        <Image
          src="/repone-live-logo.png"
          alt=""
          width={375}
          height={240}
          priority
          className="h-24 w-auto sm:h-28"
        />
        <p className="max-w-md text-center text-muted-foreground">
          Sports data, scoring, and broadcast graphics for RepOneLive competitions.
        </p>
        <div className="flex w-full max-w-xs flex-col gap-3 sm:w-auto sm:max-w-none sm:flex-row">
          <Button asChild size="touch" className="px-8">
            <Link href="/live">Live leaderboard</Link>
          </Button>
          <Button asChild variant="outline" size="touch" className="px-8">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
