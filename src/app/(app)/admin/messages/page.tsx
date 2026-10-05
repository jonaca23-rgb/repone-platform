import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { getSessionContext } from "@/lib/auth/session";
import { getConversations } from "@/lib/db/messages";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Messages" };

export default async function AdminMessagesPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");

  const conversations = await getConversations(ctx.userId, ctx.organizationId ?? "");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Messages"
        description="Direct messages with athletes. Start a new conversation from an athlete's profile on the Athletes page."
      />

      {conversations.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No messages yet"
          description="Open an athlete's profile to send them a message."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {conversations.map((c) => (
            <Link
              key={c.counterpartId}
              href={`/admin/messages/${c.counterpartId}`}
              className="flex min-h-14 items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3 hover:border-primary/60"
            >
              <div className="min-w-0">
                <p className="font-semibold">
                  {c.counterpartName}
                  {c.counterpartSublabel ? (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
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
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
