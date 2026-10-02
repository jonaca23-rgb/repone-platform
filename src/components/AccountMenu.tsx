import Link from "next/link";
import { getAuthSession } from "@/lib/auth/session";
import { userModules } from "@/lib/auth/userModules";
import { SignOutButton } from "@/components/SignOutButton";
import { signOut } from "@/app/(app)/login/actions";

/** Header menu on every signed-in screen: Home, the person's modules, Sign out. */
export async function AccountMenu() {
  const [session, modules] = await Promise.all([getAuthSession(), userModules()]);
  if (!session) return null;
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none text-sm font-bold uppercase tracking-wide text-white/80 hover:text-white">
        {session.name || session.email} ▾
      </summary>
      <div className="absolute right-0 z-50 mt-2 flex min-w-56 flex-col rounded-md border border-white/10 bg-repone-gray p-2 text-sm text-white shadow-xl">
        <Link href="/" className="rounded px-3 py-2 hover:bg-white/10">Home</Link>
        {modules.map((m) => (
          <Link key={m.kind} href={m.href} className="rounded px-3 py-2 hover:bg-white/10">
            {m.label}
            <span className="block text-xs text-white/50">{m.detail}</span>
          </Link>
        ))}
        <SignOutButton action={signOut} redirectTo="/login" className="rounded px-3 py-2 text-left text-repone-red hover:bg-white/10" />
      </div>
    </details>
  );
}
