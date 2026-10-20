import Link from "next/link";
import { ChevronRight } from "lucide-react";

/** A large tappable row on an operator picker that opens one event or floor. */
export function PickLink({ href, title, detail }: { href: string; title: string; detail: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-16 items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-display text-2xl font-semibold tracking-wide uppercase">{title}</span>
        <span className="text-sm text-muted-foreground">{detail}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
