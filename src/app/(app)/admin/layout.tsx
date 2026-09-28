import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";
import { signOut } from "@/app/(app)/login/actions";
import { getUnreadCount } from "@/lib/db/messages";
import { MessagesNavLink } from "@/components/MessagesNavLink";

const NAV = [
  { href: "/admin", label: "Events" },
  { href: "/admin/circuits", label: "Circuits" },
  { href: "/admin/athletes", label: "Athletes" },
  { href: "/admin/checkin", label: "Check-In" },
  { href: "/admin/teams", label: "Teams" },
  { href: "/admin/sponsors", label: "Sponsors" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  const unreadCount = await getUnreadCount(ctx.userId);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-black/10 bg-repone-black px-4 py-4 text-repone-white sm:px-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link href="/admin" className="shrink-0 hover:opacity-80">
            {/* eslint-disable-next-line @next/next/no-img-element -- local static asset in public/, not optimizable-domain content */}
            <img src="/repone-logo.png" alt="RepOne" className="h-9 w-auto sm:h-10" width={472} height={240} />
          </Link>
          <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-bold uppercase tracking-wide text-white/80">
            <Link href="/admin" className="hover:text-white">
              🏠 Home
            </Link>
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-white">
                {item.label}
              </Link>
            ))}
            <MessagesNavLink href="/admin/messages" userId={ctx.userId} initialUnread={unreadCount} />
            <Link
              href="/scorekeeper"
              className="rounded-full bg-repone-red/10 px-3 py-1 text-repone-red hover:bg-repone-red/20"
            >
              Score Keeper →
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full bg-repone-red/10 px-3 py-1 text-repone-red hover:bg-repone-red/20"
            >
              Production Dashboard →
            </Link>
            <Link
              href="/producer"
              className="rounded-full bg-repone-red/10 px-3 py-1 text-repone-red hover:bg-repone-red/20"
            >
              Producer →
            </Link>
            <Link
              href="/commentator"
              className="rounded-full bg-repone-red/10 px-3 py-1 text-repone-red hover:bg-repone-red/20"
            >
              Commentator →
            </Link>
            <Link
              href="/live"
              className="rounded-full bg-repone-red/10 px-3 py-1 text-repone-red hover:bg-repone-red/20"
            >
              Public Leaderboard →
            </Link>
          </nav>
        </div>
        <form action={signOut}>
          <button className="text-sm text-white/60 hover:text-white">Sign out</button>
        </form>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
