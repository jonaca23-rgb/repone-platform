import Link from "next/link";
import { ModuleMenu } from "@/components/app/ModuleMenu";
import { SkipLink } from "@/components/app/SkipLink";

/**
 * The live-operation screens (producer, production dashboard, scorekeeper,
 * commentator): a compact sticky top bar, optional event tabs under it, and
 * the page. No sidebar, so the controls keep the full width of a tablet or
 * phone. Dark from here down while the remaining areas keep their own look.
 */
export function OperatorShell({
  module,
  moduleLabel,
  moduleHref,
  eventName,
  tabs,
  children,
}: {
  module: "producer" | "scorekeeper" | "commentator";
  moduleLabel: string;
  /** Where the module label goes; defaults to the module's event picker, `/<module>`. */
  moduleHref?: string;
  eventName?: string;
  tabs?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SkipLink />
      <header className="sticky top-0 z-20 border-b border-border bg-card pt-[env(safe-area-inset-top)]">
        <div className="flex h-14 items-center gap-3 pr-[max(0.5rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))]">
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
          {/* The module label goes back to that module's event picker. */}
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Link
              href={moduleHref ?? `/${module}`}
              className="inline-flex min-h-11 shrink-0 items-center rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
            >
              {moduleLabel}
            </Link>
            {eventName ? (
              <span className="truncate font-display text-lg font-semibold tracking-wide uppercase">
                {eventName}
              </span>
            ) : null}
          </div>
          <ModuleMenu current={module} compact />
        </div>
      </header>
      {tabs}
      <main id="main" tabIndex={-1} className="flex-1 outline-hidden">
        {children}
      </main>
    </div>
  );
}
