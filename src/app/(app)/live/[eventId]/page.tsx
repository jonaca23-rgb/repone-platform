import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventLiveContext } from "@/lib/db/queries";
import { LiveEventClient } from "./LiveEventClient";

export default async function LiveEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const context = await getEventLiveContext(eventId);
  if (!context) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-6">
      <div>
        <Link
          href="/live"
          className="text-xs uppercase tracking-wide text-white/40 hover:text-white"
        >
          ← All live events
        </Link>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-wide">
          {context.eventName}
        </h1>
        {context.circuit && (
          <Link
            href={`/live/circuits/${context.circuit.id}`}
            className="text-sm text-repone-red hover:underline"
          >
            Part of {context.circuit.name} — view circuit standings →
          </Link>
        )}
      </div>

      <LiveEventClient floors={context.floors} divisions={context.divisions} />
    </div>
  );
}
