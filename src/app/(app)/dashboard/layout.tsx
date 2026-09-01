import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";
import { signOut } from "@/app/(app)/login/actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");

  return (
    <div className="min-h-screen bg-repone-black text-repone-white">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs uppercase tracking-wide text-white/50">
        <span>RepOne Production Dashboard</span>
        <form action={signOut}>
          <button className="hover:text-white">Sign out</button>
        </form>
      </div>
      {children}
    </div>
  );
}
