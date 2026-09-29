import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";
import { signOut } from "@/app/(app)/login/actions";

// Same "any signed-in staff account" gate as Score Keeper/Production
// Dashboard (see lib/auth/session.ts) — this outer shell just confirms
// someone is signed in as staff at all. The real "which events can this
// commentator actually see" check lives one level down, in
// commentator/events/[eventId]/layout.tsx, via the event-scoped assignment
// tables (0024_event_role_assignments.sql) — an admin can reach every event,
// everyone else only the ones they're assigned to.
export default async function CommentatorLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");

  return (
    <div className="min-h-screen bg-repone-black text-repone-white">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-white/10 px-4 py-2">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/admin" className="shrink-0 hover:opacity-80">
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
            href="/admin"
            className="text-xs font-bold uppercase tracking-wide text-white/60 hover:text-white"
          >
            🏠 Home
          </Link>
          <Link
            href="/commentator"
            className="text-xs font-bold uppercase tracking-wide text-white/60 hover:text-white"
          >
            Commentator
          </Link>
          <Link
            href="/scorekeeper"
            className="text-xs font-bold uppercase tracking-wide text-white/60 hover:text-white"
          >
            Score Keeper
          </Link>
          <Link
            href="/dashboard"
            className="text-xs font-bold uppercase tracking-wide text-white/60 hover:text-white"
          >
            Production Dashboard
          </Link>
          <Link
            href="/producer"
            className="text-xs font-bold uppercase tracking-wide text-white/60 hover:text-white"
          >
            Producer
          </Link>
        </div>
        <form action={signOut}>
          <button className="text-xs font-bold uppercase tracking-wide text-white/60 hover:text-white">
            Sign out
          </button>
        </form>
      </div>
      {children}
    </div>
  );
}
