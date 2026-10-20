import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getAthleteSessionContext } from "@/lib/auth/session";
import { getThread, markThreadRead, resolveCounterparts } from "@/lib/db/messages";
import { MessageComposer } from "@/components/messages/MessageComposer";
import { MessageThread } from "@/components/messages/MessageThread";
import { ThreadLiveRefresh } from "@/components/messages/ThreadLiveRefresh";
import { Button } from "@/components/ui/button";

// Read once per request: the page and its title share them.
const sessionContext = cache(getAthleteSessionContext);
// Keyed by the id string: cache() compares arguments by identity, so an array would never hit.
const counterpartOf = cache(
  async (counterpartId: string, organizationId: string) =>
    (await resolveCounterparts([counterpartId], organizationId)).get(counterpartId) ?? null,
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ counterpartId: string }>;
}): Promise<Metadata> {
  const { counterpartId } = await params;
  const ctx = await sessionContext();
  if (!ctx?.athleteId) return { title: "Messages" };
  const counterpart = await counterpartOf(counterpartId, ctx.organizationId ?? "");
  return { title: counterpart ? `Messages · ${counterpart.name}` : "Messages" };
}

export default async function AthleteThreadPage({
  params,
}: {
  params: Promise<{ counterpartId: string }>;
}) {
  const { counterpartId } = await params;
  const ctx = await sessionContext();
  if (!ctx) redirect("/login");
  if (!ctx.athleteId) redirect("/");

  const counterpart = await counterpartOf(counterpartId, ctx.organizationId ?? "");
  if (!counterpart) notFound();

  // Viewing the thread is what marks it read — there's no separate "mark as
  // read" click in this UI.
  await markThreadRead(ctx.userId, counterpartId);
  const thread = await getThread(ctx.userId, counterpartId);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button asChild variant="ghost" className="-ml-3 min-h-11 gap-2 text-muted-foreground">
          <Link href="/athlete/messages">
            <ChevronLeft aria-hidden />
            Messages
          </Link>
        </Button>
        <h1 className="font-display text-3xl font-bold tracking-wide uppercase">
          {counterpart.name}
        </h1>
        {counterpart.sublabel ? (
          <p className="text-sm text-muted-foreground">{counterpart.sublabel}</p>
        ) : null}
      </div>

      <MessageThread messages={thread} counterpartName={counterpart.name} />

      {/* Sticks above the bottom tab bar on phones, to the bottom of the screen from md up. */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] -mx-4 border-t border-border bg-background px-4 py-3 sm:-mx-6 sm:px-6 md:bottom-0">
        <MessageComposer recipientId={counterpartId} recipientName={counterpart.name} />
      </div>
      <ThreadLiveRefresh myUserId={ctx.userId} />
    </div>
  );
}
