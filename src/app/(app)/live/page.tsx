import type { Metadata } from "next";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/db/server";

export const metadata: Metadata = { title: "Live Competitions" };

/**
 * Public event picker — the entry point for athletes/spectators who don't
 * have a direct `/live/[eventId]` link. Lists every scheduled or live event
 * across the organization (there's no per-org scoping here since there's no
 * signed-in user to scope by; fine for a single-organization deployment like
 * Jonathan's, same assumption every other public-read table already makes).
 */
export default async function LiveEventsPage() {
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("events")
    .select("id, name, status, circuit_id, starts_on, ends_on, cover_image_url")
    .in("status", ["scheduled", "live"])
    .order("starts_on", { ascending: true, nullsFirst: false });

  const circuitIds = Array.from(
    new Set((events ?? []).map((e) => e.circuit_id).filter((id): id is string => !!id)),
  );
  const { data: circuits } = circuitIds.length
    ? await supabase.from("circuits").select("id, name").in("id", circuitIds)
    : { data: [] as { id: string; name: string }[] };
  const circuitNameById = new Map((circuits ?? []).map((c) => [c.id, c.name]));

  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  const dateRange = (startsOn: string | null, endsOn: string | null) => {
    if (!startsOn) return "Date TBD";
    if (!endsOn || endsOn === startsOn) return fmt(startsOn);
    return `${fmt(startsOn)} – ${fmt(endsOn)}`;
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Live Competitions"
        description="Follow along: current heat, workout and standings, updated live as the competition runs."
      />
      {events && events.length > 0 ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => (
            <li key={e.id}>
              <Link
                href={`/live/${e.id}`}
                className="group block h-full rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-hidden"
              >
                <Card className="h-full gap-0 py-0 transition-colors group-hover:ring-brand-text/60">
                  <div className="relative aspect-video w-full bg-muted">
                    {e.cover_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, not a local/optimizable asset
                      <img src={e.cover_image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Trophy className="size-10 text-muted-foreground" aria-hidden />
                      </div>
                    )}
                    {e.status === "live" && (
                      <Badge className="absolute top-2 left-2 gap-1.5 uppercase">
                        <span className="size-1.5 rounded-full bg-primary-foreground" aria-hidden />
                        Live now
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 p-4">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      {dateRange(e.starts_on, e.ends_on)}
                    </p>
                    <p className="text-lg font-bold">{e.name}</p>
                    {e.circuit_id && (
                      <p className="text-sm text-muted-foreground">
                        Part of {circuitNameById.get(e.circuit_id) ?? "a circuit"}
                      </p>
                    )}
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Trophy}
          title="No live or upcoming events right now"
          description="Check back soon: events appear here when they are scheduled."
        />
      )}
    </div>
  );
}
