"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** The tab whose route the pathname is on (or under); the longest match wins. */
export function activeTabHref(items: Array<{ href: string }>, pathname: string): string | null {
  let best: string | null = null;
  for (const { href } of items)
    if ((pathname === href || pathname.startsWith(`${href}/`)) && href.length > (best?.length ?? 0))
      best = href;
  return best;
}

/**
 * Route tabs under the operator top bar. The current one carries
 * aria-current="page"; on a phone the row scrolls sideways and keeps the
 * current tab in view.
 */
export function EventTabs({
  items,
  ariaLabel,
}: {
  items: Array<{ href: string; label: string }>;
  ariaLabel: string;
}) {
  const pathname = usePathname();
  const active = activeTabHref(items, pathname);
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  return (
    <nav aria-label={ariaLabel} className="border-b border-border bg-background">
      <ul className="mx-auto flex max-w-5xl gap-1 scroll-px-2 overflow-x-auto px-2 [scrollbar-width:none] sm:px-4">
        {items.map((item) => {
          const current = item.href === active;
          return (
            <li key={item.href} className="shrink-0">
              <Link
                ref={current ? activeRef : undefined}
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden focus-visible:ring-inset",
                  current
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
