import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ExternalLink } from "lucide-react";
import { getEventLiveContext } from "@/lib/db/queries";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { producerEventTitle } from "../producerEvent";

type Props = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: await producerEventTitle((await params).eventId, "Overview") };
}

// Event-level overview/command-center — "1. Event dashboard" in the spec,
// distinct from the "10. Production dashboard" (live floor control, the
// Production tab, which is today's existing Production Dashboard screen).
// Quick status + links into the other tabs; the actual live-running work
// happens on Production/Broadcast.
export default async function ProducerEventDashboardPage({ params }: Props) {
  const { eventId } = await params;
  const context = await getEventLiveContext(eventId);
  if (!context) notFound();

  const totalHeats = context.floors.reduce((sum, f) => sum + f.heats.length, 0);
  const liveFloors = context.floors.filter((f) => f.initialBroadcastState?.current_heat_id);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <PageHeader title="Overview" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Status">
          <span className="uppercase">{context.eventStatus}</span>
        </Stat>
        <Stat label="Floors">
          {context.floors.length}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({liveFloors.length} live)
          </span>
        </Stat>
        <Stat label="Heats">{totalHeats}</Stat>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Button asChild size="touch" className="gap-2">
          <Link href={`/producer/events/${eventId}/production`}>
            Run production
            <ArrowRight aria-hidden />
          </Link>
        </Button>
        <Button asChild size="touch" variant="secondary" className="gap-2">
          <Link href={`/live/${eventId}`} target="_blank">
            Public leaderboard
            <ExternalLink aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </Link>
        </Button>
        <Button asChild size="touch" variant="secondary" className="gap-2">
          <Link href={`/admin/events/${eventId}`}>
            Event setup (Admin)
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-xs tracking-widest text-muted-foreground uppercase">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{children}</p>
      </CardContent>
    </Card>
  );
}
