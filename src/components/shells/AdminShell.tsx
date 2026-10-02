import Link from "next/link";
import { cookies } from "next/headers";
import { ModuleMenu } from "@/components/app/ModuleMenu";
import { SkipLink } from "@/components/app/SkipLink";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminEventRoot, ConnectedAdminSidebar } from "./AdminSidebar";

/**
 * The admin area: a collapsible sidebar (a Sheet on phones) beside the page.
 * Dark from here down while the other areas keep their own look until their
 * shells land.
 */
export async function AdminShell({
  userId,
  unreadCount,
  canManageMembers,
  children,
}: {
  userId: string;
  unreadCount: number;
  canManageMembers: boolean;
  children: React.ReactNode;
}) {
  // The sidebar remembers expanded/collapsed in this cookie (components/ui/sidebar).
  const sidebarState = (await cookies()).get("sidebar_state")?.value;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SkipLink />
      <TooltipProvider>
        <AdminEventRoot>
          <SidebarProvider defaultOpen={sidebarState !== "false"}>
            <ConnectedAdminSidebar
              userId={userId}
              unreadCount={unreadCount}
              canManageMembers={canManageMembers}
              menu={<ModuleMenu current="admin" side="top" align="start" />}
            />
            <SidebarInset className="min-w-0">
              <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
                <SidebarTrigger className="-ml-1" />
                <Separator
                  orientation="vertical"
                  className="data-vertical:h-4 data-vertical:self-center"
                />
                <Link
                  href="/admin"
                  className="rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden md:hidden"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- local static asset in public/, not optimizable-domain content */}
                  <img
                    src="/repone-logo.png"
                    alt="RepOne admin"
                    width={472}
                    height={240}
                    className="h-6 w-auto"
                  />
                </Link>
                <span className="hidden text-sm text-muted-foreground md:inline">Admin</span>
              </header>
              <div id="main" tabIndex={-1} className="flex-1 p-4 outline-hidden md:p-6">
                {children}
              </div>
            </SidebarInset>
          </SidebarProvider>
        </AdminEventRoot>
      </TooltipProvider>
    </div>
  );
}
