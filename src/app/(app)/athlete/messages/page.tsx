import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, MessageSquare, Users } from "lucide-react";
import { getAthleteSessionContext } from "@/lib/auth/session";
import { getConversations, getOrgStaffDirectory } from "@/lib/db/messages";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Messages" };

const ROW =
  "flex min-h-14 items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3 hover:border-brand-text/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden";

export default async function AthleteMessagesPage() {
  const ctx = await getAthleteSessionContext();
  if (!ctx) redirect("/login");
  if (!ctx.athleteId) redirect("/");

  const organizationId = ctx.organizationId ?? "";
  const [conversations, staff] = await Promise.all([
    getConversations(ctx.userId, organizationId),
    getOrgStaffDirectory(organizationId),
  ]);

  const messagedStaffIds = new Set(
    conversations.filter((c) => c.counterpartKind === "staff").map((c) => c.counterpartId),
  );
  const newStaffContacts = staff.filter((s) => !messagedStaffIds.has(s.userId));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Messages" />

      {conversations.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No messages yet"
          description="Pick an athlete from the directory to start a conversation."
          action={
            <Button asChild variant="outline" className="min-h-11 gap-2">
              <Link href="/athlete/directory">
                <Users aria-hidden />
                Find an athlete
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {conversations.map((c) => (
            <li key={c.counterpartId}>
              <Link href={`/athlete/messages/${c.counterpartId}`} className={ROW}>
                <div className="min-w-0">
                  <p className="font-semibold">
                    {c.counterpartName}
                    {c.counterpartKind === "staff" && c.counterpartSublabel ? (
                      <span className="ml-2 text-xs font-normal tracking-wide text-brand-text uppercase">
                        {c.counterpartSublabel}
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {c.lastMessageFromMe ? "You: " : ""}
                    {c.lastMessage}
                  </p>
                </div>
                {c.unreadCount > 0 ? (
                  <Badge className="shrink-0">
                    {c.unreadCount}
                    <span className="sr-only"> unread</span>
                  </Badge>
                ) : (
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {newStaffContacts.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
            Message Staff
          </h2>
          <ul className="flex flex-col gap-2">
            {newStaffContacts.map((s) => (
              <li key={s.userId}>
                <Link href={`/athlete/messages/${s.userId}`} className={ROW}>
                  <p className="min-w-0 truncate">{s.fullName}</p>
                  <p className="shrink-0 text-xs tracking-wide text-muted-foreground uppercase">
                    {s.roleLabels.join(", ")}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
