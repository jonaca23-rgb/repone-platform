import Link from "next/link";
import { redirect } from "next/navigation";
import { getAthleteSessionContext } from "@/lib/auth/session";
import { getConversations, getOrgStaffDirectory } from "@/lib/db/messages";

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
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-white">Messages</h1>
        <Link href="/athlete/directory" className="text-sm text-repone-red underline">
          Message an athlete →
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        {conversations.map((c) => (
          <Link
            key={c.counterpartId}
            href={`/athlete/messages/${c.counterpartId}`}
            className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-repone-gray px-4 py-3 hover:border-repone-red/40"
          >
            <div className="min-w-0">
              <p className="font-semibold text-white">
                {c.counterpartName}
                {c.counterpartKind === "staff" && c.counterpartSublabel ? (
                  <span className="ml-2 text-xs font-normal uppercase tracking-wide text-repone-red">
                    {c.counterpartSublabel}
                  </span>
                ) : null}
              </p>
              <p className="truncate text-sm text-white/50">
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
        {conversations.length === 0 && <p className="text-white/50">No messages yet.</p>}
      </div>

      {newStaffContacts.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-white/60">
            Message Staff
          </h2>
          <div className="flex flex-col gap-2">
            {newStaffContacts.map((s) => (
              <Link
                key={s.userId}
                href={`/athlete/messages/${s.userId}`}
                className="flex items-center justify-between rounded-lg border border-white/10 px-4 py-3 hover:border-repone-red/40"
              >
                <p className="text-white">{s.fullName}</p>
                <p className="text-xs uppercase tracking-wide text-white/50">
                  {s.roleLabels.join(", ")}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
