import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Dumbbell } from "lucide-react";
import { getEventLiveContext } from "@/lib/db/queries";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { wodSummary } from "@/lib/scoring/format";
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
      {wods.length > 0 ? (
        <Accordion type="multiple" className="rounded-xl border border-border px-4">
          {wods.map((w) => (
            <AccordionItem key={w.id} value={w.id}>
              <AccordionTrigger className="min-h-11 text-left">
                <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-lg font-bold">{w.name}</span>
                  <Badge variant="outline" className="tracking-wide text-brand-text uppercase">
                    {wodSummary(w).slice(w.name.length + 3)}
                  </Badge>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                {w.description ? (
                  <p className="text-sm whitespace-pre-wrap">{w.description}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">No description on file.</p>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : null}
      {wods.length === 0 && (
        <EmptyState icon={Dumbbell} title="No WODs scheduled for this event yet" />
      )}
    </div>
  );
}
