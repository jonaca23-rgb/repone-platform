import type { CommentatorAthleteDetails } from "@/lib/db/commentator";
import type { FloorHeat } from "@/lib/db/queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const MAX_STATS = 4;
const CHIP = "rounded-full bg-muted px-2.5 py-0.5 text-sm";
const SECTION = "text-xs font-bold tracking-widest text-muted-foreground uppercase";

type Lane = FloorHeat["lanes"][number];

/**
 * One athlete in the current heat, compact enough that a laptop shows a whole
 * heat at once: lane and name, affiliate and age category, up to four lifts or
 * benchmarks, and the most recent event, with the rest one tap away.
 */
export function AthleteCard({
  lane,
  details,
}: {
  lane: Lane;
  details: CommentatorAthleteDetails | undefined;
}) {
  const stats = [
    ...(details?.lifts ?? []).map((l) => ({ id: l.id, label: l.label, value: l.valueDisplay })),
    ...(details?.benchmarks ?? []).map((b) => ({
      id: b.id,
      label: b.name,
      value: b.resultDisplay,
    })),
  ];
  const [latest, ...older] = details?.history ?? [];
  const empty = stats.length === 0 && !latest;

  return (
    <Card size="sm" className="h-full">
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded bg-primary font-display text-lg font-bold text-primary-foreground">
            {lane.laneNumber}
          </span>
          <div className="min-w-0">
            <h2 className="text-xl leading-tight font-bold">{lane.name}</h2>
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {lane.affiliate ? <span>{lane.affiliate}</span> : null}
              {details?.ageCategoryLabel ? (
                <Badge variant="outline" className="tracking-wide text-brand-text uppercase">
                  {details.ageCategoryLabel}
                </Badge>
              ) : null}
            </p>
          </div>
        </div>

        {empty ? (
          <p className="text-sm text-muted-foreground">
            No lifts, benchmarks or history on file yet.
          </p>
        ) : null}

        {stats.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <h3 className={SECTION}>Lifts &amp; benchmarks</h3>
            <div className="flex flex-wrap gap-1.5">
              {stats.slice(0, MAX_STATS).map((s) => (
                <span key={s.id} className={CHIP}>
                  {s.label}: <span className="font-semibold">{s.value}</span>
                </span>
              ))}
              {stats.length > MAX_STATS ? (
                <span className={`${CHIP} text-muted-foreground`}>
                  +{stats.length - MAX_STATS} more
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {latest ? (
          <div className="flex flex-col gap-1.5">
            <h3 className={SECTION}>Previous standings</h3>
            <HistoryLine h={latest} />
            {older.length > 0 ? (
              <details className="group">
                <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-brand-text">
                  +{older.length} more events
                </summary>
                <div className="flex flex-col gap-1.5 pt-1">
                  {older.map((h) => (
                    <HistoryLine key={h.eventId} h={h} />
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function HistoryLine({ h }: { h: CommentatorAthleteDetails["history"][number] }) {
  return (
    <div className="text-sm">
      <span className="font-semibold">{h.eventName}</span>
      <span className="text-muted-foreground"> ({h.divisionName})</span>
      {h.overall?.placement ? (
        <span className="ml-2 font-semibold whitespace-nowrap text-brand-text">
          #{h.overall.placement} overall
        </span>
      ) : null}
      {h.wods.length > 0 ? (
        <div className="mt-0.5 flex flex-wrap gap-1">
          {h.wods.map((w) => (
            <span
              key={w.wodId}
              className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {w.name}: {w.placement ? `#${w.placement}` : "—"}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
