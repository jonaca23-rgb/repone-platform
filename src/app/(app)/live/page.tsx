import Link from "next/link";
import { createClient } from "@/lib/db/server";

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

  const circuitIds = Array.from(new Set((events ?? []).map((e) => e.circuit_id).filter((id): id is string => !!id)));
  const { data: circuits } = circuitIds.length
    ? await supabase.from("circuits").select("id, name").in("id", circuitIds)
    : { data: [] as { id: string; name: string }[] };
  const circuitNameById = new Map((circuits ?? []).map((c) => [c.id, c.name]));

  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const dateRange = (startsOn: string | null, endsOn: string | null) => {
    if (!startsOn) return "Date TBD";
    if (!endsOn || endsOn === startsOn) return fmt(startsOn);
    return `${fmt(startsOn)} — ${fmt(endsOn)}`;
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="mb-2 font-[family-name:var(--font-display)] text-3xl font-bold uppercase tracking-wide">
        Live Competitions
      </h1>
      <p className="mb-8 text-sm text-white/50">
        Follow along — current heat, WOD, and standings, updated live as the competition runs.
      </p>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {(events ?? []).map((e) => (
          <Link
            key={e.id}
            href={`/live/${e.id}`}
            className="overflow-hidden rounded-lg border border-white/10 hover:border-repone-red"
          >
            <div className="relative aspect-video w-full bg-black">
              {e.cover_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, not a local/optimizable asset
                <img src={e.cover_image_url} alt={e.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <span className="px-4 text-center text-sm font-semibold uppercase tracking-wide text-white/20">
                    RepOne Live
                  </span>
                </div>
              )}
              {e.status === "live" && (
                <span className="absolute left-2 top-2 rounded-full bg-repone-red px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                  ● Live Now
                </span>
              )}
            </div>
            <div className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/40">
                {dateRange(e.starts_on, e.ends_on)}
              </p>
              <p className="mt-0.5 text-lg font-bold">{e.name}</p>
              {e.circuit_id && (
                <p className="mt-1 text-sm text-white/50">Part of {circuitNameById.get(e.circuit_id) ?? "a circuit"}</p>
              )}
            </div>
          </Link>
        ))}
        {(!events || events.length === 0) && (
          <p className="text-white/50">No live or upcoming events right now — check back soon.</p>
        )}
      </div>
    </div>
  );
}
