import { createClient } from "@/lib/db/server";
import type { Database } from "@/lib/db/database.types";
import { compareDivisionNames, compareHeatsForRunningOrder } from "@/lib/scoring/divisionOrder";

export interface FloorHeat {
  id: string;
  heatNumber: number;
  heatCount: number | null;
  // Set once the Score Keeper's "Save all & Finish Heat" button has been
  // used on this heat (see finishHeat in lib/actions/heats.ts) — lets the
  // Score Keeper screen show a "✓ Finished" badge and disable that button.
  endedAt: string | null;
  // created_at drives the WOD running order (see lib/scoring/divisionOrder.ts)
  // — it's the only signal for "which WOD was entered first," since a WOD's
  // name (unlike a division's) carries no ordering information.
  wod: {
    id: string;
    name: string;
    description: string | null;
    scoring_type: string;
    time_cap_seconds: number | null;
    created_at: string;
  };
  division: { id: string; name: string };
  lanes: Array<{
    laneNumber: number;
    athleteId: string | null;
    name: string | null;
    affiliate: string | null;
  }>;
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
  ended_at: string | null;
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
      "id, heat_number, heat_count, ended_at, wods(id, name, description, scoring_type, time_cap_seconds, created_at), divisions(id, name), lanes(lane_number, athlete_id, athletes(first_name, last_name, affiliate))",
    )
    .eq("floor_id", floorId);
  const heats = (heatsRaw ?? []) as unknown as RawHeatRow[];

  const floorHeats: FloorHeat[] = heats
    .filter((h) => h.wods && h.divisions)
    .map((h) => ({
      id: h.id,
      heatNumber: h.heat_number,
      heatCount: h.heat_count,
      endedAt: h.ended_at,
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
    }))
    // Running order across WODs and divisions (see lib/scoring/divisionOrder.ts)
    // — heat_number alone only orders heats WITHIN one wod/division, so every
    // screen built on this needs this explicit resort to show e.g. Fran's
    // heats fully before Grace's, and within a WOD, Scale Male before Scale
    // Female before Rx Male, as Jonathan runs them in practice.
    .sort((a, b) =>
      compareHeatsForRunningOrder(
        { wodCreatedAt: a.wod.created_at, divisionName: a.division.name, heatNumber: a.heatNumber },
        { wodCreatedAt: b.wod.created_at, divisionName: b.division.name, heatNumber: b.heatNumber },
      ),
    );

  return { floorId, eventId, eventName, heats: floorHeats };
}

type BroadcastStateRow = Database["public"]["Tables"]["broadcast_state"]["Row"];

export interface EventLiveFloor {
  floorId: string;
  floorName: string;
  venueName: string;
  heats: FloorHeat[];
  initialBroadcastState: BroadcastStateRow | null;
}

export interface EventLiveContext {
  eventId: string;
  eventName: string;
  eventStatus: string;
  circuit: { id: string; name: string } | null;
  floors: EventLiveFloor[];
  divisions: Array<{ id: string; name: string }>;
}

/**
 * The public-facing counterpart to getFloorContext above: everything the
 * unauthenticated `/live/[eventId]` leaderboard page needs for a whole event
 * at once (every floor's heats + live broadcast_state, plus the event's
 * divisions for the standings section below it) in one server-side fetch.
 * Every table queried here already has a "public read" RLS policy (same
 * tables the OBS overlays already read from an unauthenticated browser
 * source) — no schema/RLS change was needed to add this page.
 */
export async function getEventLiveContext(eventId: string): Promise<EventLiveContext | null> {
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, name, status, circuit_id")
    .eq("id", eventId)
    .single();
  if (!event) return null;

  const { data: circuit } = event.circuit_id
    ? await supabase.from("circuits").select("id, name").eq("id", event.circuit_id).single()
    : { data: null as { id: string; name: string } | null };

  const { data: venues } = await supabase.from("venues").select("id, name").eq("event_id", eventId);
  const venueIds = (venues ?? []).map((v) => v.id);
  const venueNameById = new Map((venues ?? []).map((v) => [v.id, v.name]));

  const { data: floorsRaw } = venueIds.length
    ? await supabase
        .from("floors")
        .select("id, name, venue_id")
        .in("venue_id", venueIds)
        .order("sort_order")
    : { data: [] as { id: string; name: string; venue_id: string }[] };
  const floors = floorsRaw ?? [];

  // divisions.sort_order defaults to 0 for every row and nothing sets it to
  // anything else today, so ordering by it alone is a no-op — use the same
  // name-based running order as heats below (see lib/scoring/divisionOrder.ts)
  // instead, so the division tabs on the public Live Leaderboard match the
  // same Scale-then-Rx, Male-then-Female order as the heat listings.
  const { data: divisionsRaw } = await supabase
    .from("divisions")
    .select("id, name")
    .eq("event_id", eventId);
  const divisions = (divisionsRaw ?? [])
    .slice()
    .sort((a, b) => compareDivisionNames(a.name, b.name));

  const { data: heatsRaw } = await supabase
    .from("heats")
    .select(
      "id, floor_id, heat_number, heat_count, ended_at, wods(id, name, description, scoring_type, time_cap_seconds, created_at), divisions(id, name), lanes(lane_number, athlete_id, athletes(first_name, last_name, affiliate))",
    )
    .eq("event_id", eventId);
  const heatsAll = (heatsRaw ?? []) as unknown as (RawHeatRow & { floor_id: string })[];

  const heatsByFloor = new Map<string, FloorHeat[]>();
  for (const h of heatsAll) {
    if (!h.wods || !h.divisions) continue;
    const list = heatsByFloor.get(h.floor_id) ?? [];
    list.push({
      id: h.id,
      heatNumber: h.heat_number,
      heatCount: h.heat_count,
      endedAt: h.ended_at,
      wod: h.wods,
      division: h.divisions,
      lanes: (h.lanes ?? [])
        .slice()
        .sort((a, b) => a.lane_number - b.lane_number)
        .map((l) => ({
          laneNumber: l.lane_number,
          athleteId: l.athlete_id,
          name: l.athletes ? `${l.athletes.first_name} ${l.athletes.last_name}` : null,
          affiliate: l.athletes?.affiliate ?? null,
        })),
    });
    heatsByFloor.set(h.floor_id, list);
  }

  const floorIds = floors.map((f) => f.id);
  const { data: broadcastStates } = floorIds.length
    ? await supabase.from("broadcast_state").select("*").in("floor_id", floorIds)
    : { data: [] as BroadcastStateRow[] };
  const broadcastByFloor = new Map((broadcastStates ?? []).map((b) => [b.floor_id, b]));

  return {
    eventId: event.id,
    eventName: event.name,
    eventStatus: event.status,
    circuit,
    floors: floors.map((f) => ({
      floorId: f.id,
      floorName: f.name,
      venueName: venueNameById.get(f.venue_id) ?? "",
      heats: (heatsByFloor.get(f.id) ?? []).slice().sort((a, b) =>
        compareHeatsForRunningOrder(
          {
            wodCreatedAt: a.wod.created_at,
            divisionName: a.division.name,
            heatNumber: a.heatNumber,
          },
          {
            wodCreatedAt: b.wod.created_at,
            divisionName: b.division.name,
            heatNumber: b.heatNumber,
          },
        ),
      ),
      initialBroadcastState: broadcastByFloor.get(f.id) ?? null,
    })),
    divisions,
  };
}
