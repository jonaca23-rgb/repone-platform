import Link from "next/link";
import { requireModule } from "@/lib/auth/userModules";
import { AccountMenu } from "@/components/AccountMenu";

// Outer shell for the Producer tree — same "any signed-in staff account"
// gate as Score Keeper/Commentator/Production Dashboard. The real "which
// events can this producer actually touch" check lives one level down, in
// producer/events/[eventId]/layout.tsx, via event_producer_assignments
// (0024_event_role_assignments.sql) — an admin can reach every event,
// everyone else only the ones they're assigned to produce.
export default async function ProducerLayout({ children }: { children: React.ReactNode }) {
  await requireModule("producer");

  return (
    <div className="min-h-screen bg-repone-black text-repone-white">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-white/10 px-4 py-2">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/" className="shrink-0 hover:opacity-80">
            {/* eslint-disable-next-line @next/next/no-img-element -- local static asset in public/, not optimizable-domain content */}
            <img
              src="/repone-logo.png"
              alt="RepOne"
              className="h-6 w-auto"
              width={472}
              height={240}
            />
          </Link>
          <span className="text-white/20">|</span>
          <Link
            href="/"
            className="text-xs font-bold uppercase tracking-wide text-white/60 hover:text-white"
          >
            🏠 Home
          </Link>
          <Link
            href="/producer"
            className="text-xs font-bold uppercase tracking-wide text-white/60 hover:text-white"
          >
            Producer
          </Link>
          <Link
            href="/scorekeeper"
            className="text-xs font-bold uppercase tracking-wide text-white/60 hover:text-white"
          >
            Score Keeper
          </Link>
          <Link
            href="/commentator"
            className="text-xs font-bold uppercase tracking-wide text-white/60 hover:text-white"
          >
            Commentator
          </Link>
        </div>
        <AccountMenu />
      </div>
      {children}
    </div>
  );
}
