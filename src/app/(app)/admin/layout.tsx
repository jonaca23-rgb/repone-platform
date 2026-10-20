import { getSessionContext, orgCan } from "@/lib/auth/session";
import { requireModule } from "@/lib/auth/userModules";
import { getUnreadCount } from "@/lib/db/messages";
import { AdminShell } from "@/components/shells/AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireModule("admin");
  const ctx = await getSessionContext();
  if (!ctx) return null; // unreachable: requireModule redirects when signed out
  const unreadCount = await getUnreadCount(ctx.userId);

  return (
    <AdminShell
      userId={ctx.userId}
      unreadCount={unreadCount}
      // Members is for those who may add org members (owner, admin).
      canManageMembers={orgCan(ctx, { member: ["create"] })}
    >
      {children}
    </AdminShell>
  );
}
