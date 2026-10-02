import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPinOff, Radio } from "lucide-react";
import { getEventLiveContext } from "@/lib/db/queries";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { commentatorEventTitle } from "../commentatorEvent";

type Props = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: await commentatorEventTitle((await params).eventId, "Lanes") };
}

// Quick "who's in the lanes right now" reference per floor — the live heat
// if one is running, else the first scheduled heat. Full per-athlete
// stats/history live on the Dashboard tab; this tab is just lane numbers
// and names for a fast glance.
export default async function CommentatorEventLanesPage({ params }: Props) {
  const { eventId } = await params;
  const context = await getEventLiveContext(eventId);
  if (!context) notFound();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6">
      <PageHeader title="Lanes" />
      {context.floors.map((floor) => {
        const liveHeatId = floor.initialBroadcastState?.current_heat_id ?? null;
        const heat = floor.heats.find((h) => h.id === liveHeatId) ?? floor.heats[0] ?? null;
        const lanes = (heat?.lanes ?? [])
          .filter((l) => l.athleteId)
          .sort((a, b) => a.laneNumber - b.laneNumber);

        return (
          <section key={floor.floorId} className="flex flex-col gap-2">
            <h2 className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
              {floor.venueName} — {floor.floorName}
            </h2>
            {!heat ? (
              <p className="text-sm text-muted-foreground">No heats scheduled on this floor yet.</p>
            ) : (
              <>
                <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                  {heat.wod.name} · Heat {heat.heatNumber} — {heat.division.name}
                  {heat.id === liveHeatId && (
                    <span className="inline-flex items-center gap-1 font-bold text-brand-text">
                      <Radio className="size-4" aria-hidden />
                      Live
                    </span>
                  )}
                </p>
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {lanes.map((l) => (
                    <li key={l.laneNumber}>
                      <Card size="sm" className="h-full">
                        <CardContent className="flex flex-row items-center gap-3">
                          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded bg-primary text-sm font-bold text-primary-foreground">
                            {l.laneNumber}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{l.name}</p>
                            {l.affiliate && (
                              <p className="truncate text-xs text-muted-foreground">
                                {l.affiliate}
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </li>
                  ))}
                </ul>
                {lanes.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No athletes assigned to lanes yet.
                  </p>
                )}
              </>
            )}
          </section>
        );
      })}
      {context.floors.length === 0 && (
        <EmptyState icon={MapPinOff} title="No floors set up for this event yet" />
      )}
    </div>
  );
}
