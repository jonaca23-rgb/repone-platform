import Image from "next/image";
import Link from "next/link";
import { Play } from "lucide-react";
import { SkipLink } from "@/components/app/SkipLink";
import { Button } from "@/components/ui/button";

const YOUTUBE_URL = "https://youtube.com/@reponelive?si=FH5VMRdLD3DO-C2g";

/**
 * The public live area, read by spectators on their phones: the logo, one
 * call to action (the YouTube stream) and a quiet organizer sign-in link at
 * the foot. No account menu: nobody needs to be signed in here. Dark from
 * here down while the (app) root body is still light.
 */
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background text-foreground">
      <SkipLink />
      <header className="border-b border-border bg-card pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4">
          <Link
            href="/live"
            className="flex min-h-11 shrink-0 items-center rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
          >
            <Image
              src="/repone-live-logo.png"
              alt="RepOne Live"
              width={375}
              height={240}
              priority
              className="h-9 w-auto"
            />
          </Link>
          <Button asChild className="h-11 gap-2 px-4">
            <a href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer">
              <Play aria-hidden />
              Watch on YouTube
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </Button>
        </div>
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 outline-hidden"
      >
        {children}
      </main>
      <footer className="border-t border-border pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex w-full max-w-5xl justify-center px-4 py-2">
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center rounded-sm px-2 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
          >
            Organizer sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}
