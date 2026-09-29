import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";
import { getConversations } from "@/lib/db/messages";

export default async function AdminMessagesPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");

  const conversations = await getConversations(ctx.userId, ctx.organizationId ?? "");

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Messages</h1>
      <p className="mb-6 text-sm text-black/50">
        Direct messages with athletes. Start a new conversation from an athlete&apos;s profile on
        the
        <Link href="/admin/athletes" className="ml-1 text-repone-red underline">
          Athlete Roster
        </Link>
        .
      </p>

      <div className="flex flex-col gap-2">
        {conversations.map((c) => (
          <Link
            key={c.counterpartId}
            href={`/admin/messages/${c.counterpartId}`}
            className="flex items-center justify-between gap-4 rounded-lg border border-black/10 px-4 py-3 hover:border-repone-red/40"
          >
            <div className="min-w-0">
              <p className="font-semibold">
                {c.counterpartName}
                {c.counterpartSublabel ? (
                  <span className="ml-2 text-sm font-normal text-black/40">
                    {c.counterpartSublabel}
                  </span>
                ) : null}
              </p>
              <p className="truncate text-sm text-black/50">
                {c.lastMessageFromMe ? "You: " : ""}
                {c.lastMessage}
              </p>
            </div>
            {c.unreadCount > 0 ? (
              <span className="shrink-0 rounded-full bg-repone-red px-2 py-0.5 text-xs font-bold text-white">
                {c.unreadCount}
              </span>
            ) : null}
          </Link>
        ))}
        {conversations.length === 0 && <p className="text-black/50">No messages yet.</p>}
      </div>
    </div>
  );
}
