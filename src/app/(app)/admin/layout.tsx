import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";
import { signOut } from "@/app/(app)/login/actions";

const NAV = [
  { href: "/admin", label: "Events" },
  { href: "/admin/athletes", label: "Athletes" },
  { href: "/admin/sponsors", label: "Sponsors" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-black/10 bg-repone-black px-6 py-4 text-repone-white">
        <div className="flex items-center gap-8">
          <span className="font-[family-name:var(--font-display)] text-lg font-bold uppercase tracking-wide">
            RepOne <span className="text-repone-red">Admin</span>
          </span>
          <nav className="flex gap-5 text-sm font-medium uppercase tracking-wide text-white/70">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-white">
                {item.label}
              </Link>
            ))}
            <Link href="/dashboard" className="text-repone-red hover:text-repone-red/80">
              Production Dashboard →
            </Link>
          </nav>
        </div>
        <form action={signOut}>
          <button className="text-sm text-white/60 hover:text-white">Sign out</button>
        </form>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
