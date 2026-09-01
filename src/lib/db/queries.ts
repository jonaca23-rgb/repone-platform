import { createClient } from "@/lib/db/server";

export interface FloorHeat {
  id: string;
  heatNumber: number;
  heatCount: number | null;
  wod: { id: string; name: string; description: string | null; scoring_type: string; time_cap_seconds: number | null };
  division: { id: string; name: string };
  lanes: Array<{ laneNumber: number; athleteId: string | null; name: string | null; affiliate: string | null }>;
}

// Shapes matching the actual runtime rows PostgREST returns for these selects.
// NOTE: our Supabase clients are intentionally untyped (see client.ts/server.ts) —
// without generated Relationships metadata, the query builder can't infer that a
// many-to-one embed (e.g. a heat's single wod) comes back as one object rather
// than an array, so we assert the real shape here instead of fighting the
// inferred `any[]` type at every call site.
interface RawFloorRow {
  id: string;
  name: string;
  venues: { event_id: string; name: string; events: { id: string; name: string } } | null;
}

interface RawHeatRow {
  id: string;
  heat_number: number;
  heat_count: number | null;
  wods: FloorHeat["wod"] | null;
  divisions: FloorHeat["division"] | null;
  lanes: Array<{
    lane_number: number;
    athlete_id: string | null;
    athletes: { first_name: string; last_name: string; affiliate: string | null } | null;
  }> | null;
}

/**
 * The shared "floor context" used by both the Production Dashboard and every
 * broadcast overlay: every heat on this floor, fully expanded with WOD,
 * division, and lane/athlete data, so the operator selecting a heat is the
 * only manual step — everything downstream (graphics, lower thirds, scoring
 * context) is already attached.
 */
export async function getFloorContext(floorId: string) {
  const supabase = await createClient();

  const { data: floorRaw } = await supabase
    .from("floors")
    .select("id, name, venues(event_id, name, events(id, name))")
    .eq("id", floorId)
    .single();
  const floor = floorRaw as unknown as RawFloorRow | null;
  if (!floor?.venues) return null;

  const eventId = floor.venues.events.id;
  const eventName = floor.venues.events.name;

  const { data: heatsRaw } = await supabase
    .from("heats")
    .select(
      "id, heat_number, heat_count, wods(id, name, description, scoring_type, time_cap_seconds), divisions(id, name), lanes(lane_number, athlete_id, athletes(first_name, last_name, affiliate))"
    )
    .eq("floor_id", floorId)
    .order("heat_number");
  const heats = (heatsRaw ?? []) as unknown as RawHeatRow[];

  const floorHeats: FloorHeat[] = heats
    .filter((h) => h.wods && h.divisions)
    .map((h) => ({
      id: h.id,
      heatNumber: h.heat_number,
      heatCount: h.heat_count,
      wod: h.wods!,
      division: h.divisions!,
      lanes: (h.lanes ?? [])
        .slice()
        .sort((a, b) => a.lane_number - b.lane_number)
        .map((l) => ({
          laneNumber: l.lane_number,
          athleteId: l.athlete_id,
          name: l.athletes ? `${l.athletes.first_name} ${l.athletes.last_name}` : null,
          affiliate: l.athletes?.affiliate ?? null,
        })),
    }));

  return { floorId, eventId, eventName, heats: floorHeats };
}
