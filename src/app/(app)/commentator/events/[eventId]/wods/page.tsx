import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Dumbbell } from "lucide-react";
import { getEventLiveContext } from "@/lib/db/queries";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { commentatorEventTitle } from "../commentatorEvent";

type Props = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: await commentatorEventTitle((await params).eventId, "WODs") };
}

export default async function CommentatorEventWodsPage({ params }: Props) {
  const { eventId } = await params;
  const context = await getEventLiveContext(eventId);
  if (!context) notFound();

  // Same WOD can appear on multiple floors' heats (or across divisions) —
  // dedupe by id so it's listed once.
  const wodById = new Map(context.floors.flatMap((f) => f.heats.map((h) => [h.wod.id, h.wod])));
  const wods = Array.from(wodById.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6">
      <PageHeader title="WODs" />
      {wods.map((w) => (
        <Card key={w.id}>
          <CardHeader className="flex flex-wrap items-baseline justify-between gap-2">
            <CardTitle className="text-xl font-bold">{w.name}</CardTitle>
            <Badge variant="outline" className="tracking-wide text-brand-text uppercase">
              {w.scoring_type.replace("_", " ")}
              {w.time_cap_seconds ? ` · ${Math.round(w.time_cap_seconds / 60)} min cap` : ""}
            </Badge>
          </CardHeader>
          <CardContent>
            {w.description ? (
              <p className="text-sm whitespace-pre-wrap">{w.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No description on file.</p>
            )}
          </CardContent>
        </Card>
      ))}
      {wods.length === 0 && (
        <EmptyState icon={Dumbbell} title="No WODs scheduled for this event yet" />
      )}
    </div>
  );
}
