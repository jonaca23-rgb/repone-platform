import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getEventLiveContext } from "@/lib/db/queries";
import { LiveEventClient } from "./LiveEventClient";

// One lookup per request, shared by generateMetadata and the page.
const liveContext = cache(getEventLiveContext);

type Props = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const context = await liveContext((await params).eventId);
  return { title: context ? `${context.eventName} live` : "Event not found" };
}

export default async function LiveEventPage({ params }: Props) {
  const { eventId } = await params;
  const context = await liveContext(eventId);
  if (!context) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link
          href="/live"
          className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
        >
          <ArrowLeft className="size-4" aria-hidden />
          All live events
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-wide text-balance uppercase">
          {context.eventName}
        </h1>
        {context.circuit && (
          <Link
            href={`/live/circuits/${context.circuit.id}`}
            className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-sm text-sm text-brand-text hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
          >
            Part of {context.circuit.name}: view circuit standings
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>

      <LiveEventClient floors={context.floors} divisions={context.divisions} />
    </div>
  );
}
