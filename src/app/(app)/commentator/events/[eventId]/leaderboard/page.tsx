import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEventLiveContext } from "@/lib/db/queries";
import { LiveEventClient } from "@/app/(app)/live/[eventId]/LiveEventClient";
import { PageHeader } from "@/components/app/PageHeader";
import { commentatorEventTitle } from "../commentatorEvent";

type Props = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: await commentatorEventTitle((await params).eventId, "Leaderboard") };
}

// Same "Now Competing" + per-division leaderboard the public /live/[eventId]
// page shows spectators — a commentator needs the exact same view, just
// reached from inside the staff-only event tree instead of the public site.
export default async function CommentatorEventLeaderboardPage({ params }: Props) {
  const { eventId } = await params;
  const context = await getEventLiveContext(eventId);
  if (!context) notFound();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <PageHeader title="Leaderboard" />
      <LiveEventClient floors={context.floors} divisions={context.divisions} />
    </div>
  );
}
