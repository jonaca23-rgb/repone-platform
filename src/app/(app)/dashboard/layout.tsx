import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";
import { signOut } from "@/app/(app)/login/actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");

  return (
    <div className="min-h-screen bg-repone-black text-repone-white">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-white/10 px-4 py-2">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/admin" className="shrink-0 hover:opacity-80">
            {/* eslint-disable-next-line @next/next/no-img-element -- local static asset in public/, not optimizable-domain content */}
            <img src="/repone-logo.png" alt="RepOne" className="h-6 w-auto" width={472} height={240} />
          </Link>
          <span className="text-white/20">|</span>
          <Link href="/admin" className="text-xs font-bold uppercase tracking-wide text-white/60 hover:text-white">
            🏠 Home
          </Link>
          <Link href="/dashboard" className="text-xs font-bold uppercase tracking-wide text-white/60 hover:text-white">
            Production Dashboard
          </Link>
          <Link href="/producer" className="text-xs font-bold uppercase tracking-wide text-white/60 hover:text-white">
            Producer
          </Link>
          <Link href="/commentator" className="text-xs font-bold uppercase tracking-wide text-white/60 hover:text-white">
            Commentator
          </Link>
        </div>
        <form action={signOut}>
          <button className="text-xs font-bold uppercase tracking-wide text-white/60 hover:text-white">Sign out</button>
        </form>
      </div>
      {children}
    </div>
  );
}
