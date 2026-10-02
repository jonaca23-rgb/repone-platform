import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Send } from "lucide-react";
import { getAthleteSessionContext } from "@/lib/auth/session";
import { getThread, markThreadRead, resolveCounterparts } from "@/lib/db/messages";
import { sendMessage } from "@/lib/actions/messages";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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

      <ol className="flex flex-col gap-3" aria-label={`Conversation with ${counterpart.name}`}>
        {thread.map((m) => (
          <li
            key={m.id}
            className={`max-w-[85%] rounded-lg px-4 py-2 sm:max-w-md ${
              m.fromMe
                ? "ml-auto bg-primary text-primary-foreground"
                : "border border-border bg-card text-card-foreground"
            }`}
          >
            <p className="text-sm break-words whitespace-pre-wrap">{m.body}</p>
            <p
              className={`mt-1 text-xs ${m.fromMe ? "text-primary-foreground" : "text-muted-foreground"}`}
            >
              <span className="sr-only">{m.fromMe ? "You, " : `${counterpart.name}, `}</span>
              {new Date(m.createdAt).toLocaleString()}
            </p>
          </li>
        ))}
        {thread.length === 0 && (
          <li className="text-muted-foreground">No messages yet — say hello.</li>
        )}
      </ol>

      {/* Sticks above the bottom tab bar on phones, to the bottom of the screen from md up. */}
      <form
        action={sendMessage.bind(null, counterpartId)}
        className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] -mx-4 flex items-end gap-2 border-t border-border bg-background px-4 py-3 sm:-mx-6 sm:px-6 md:bottom-0"
      >
        <div className="grid min-w-0 flex-1 gap-2">
          <Label htmlFor="message-body" className="sr-only">
            Message to {counterpart.name}
          </Label>
          <Textarea
            id="message-body"
            name="body"
            required
            rows={2}
            maxLength={2000}
            placeholder="Write a message…"
            className="max-h-40 min-h-11"
          />
        </div>
        <Button type="submit" size="touch" className="gap-2 px-4">
          <Send aria-hidden />
          Send
        </Button>
      </form>
    </div>
  );
}
