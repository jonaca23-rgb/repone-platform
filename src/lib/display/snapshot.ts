import { type FloorHeat, getFloorContext } from "@/lib/db/queries";
import { createClient } from "@/lib/db/server";
import { type EventSponsor, getEventSponsors } from "@/lib/db/sponsors";
import type { BlockSetting } from "./eligibility";
import type { InfoBlockType } from "./scheduler";
import { toBlockSettings } from "./toBlockSettings";

export interface DisplayDevice {
  id: string;
  eventId: string;
  floorId: string;
  name: string;
  enabled: boolean;
  sponsorsEnabled: boolean;
  infoBlocksBetweenSponsors: number;
}

/** Everything a venue display shows, read on the server and refreshed on change. */
export interface DisplaySnapshot {
  device: DisplayDevice;
  blocks: BlockSetting[];
  /** The event's sponsors whose package shows on the venue display. */
  sponsors: EventSponsor[];
  heats: FloorHeat[];
  eventName: string;
}

interface RawDevice {
  id: string;
  event_id: string;
  floor_id: string;
  name: string;
  enabled: boolean;
  sponsors_enabled: boolean;
  info_blocks_between_sponsors: number;
  display_blocks: Array<{
    block_type: InfoBlockType;
    enabled: boolean;
    duration_seconds: number;
    weight: number;
  }>;
}

/** Null when the display doesn't exist or the URL names another event. */
export async function loadDisplaySnapshot(
  eventId: string,
  displayId: string,
): Promise<DisplaySnapshot | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("display_devices")
    .select(
      "id, event_id, floor_id, name, enabled, sponsors_enabled, info_blocks_between_sponsors, display_blocks(block_type, enabled, duration_seconds, weight)",
    )
    .eq("id", displayId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const d = data as RawDevice | null;
  if (!d || d.event_id !== eventId) return null;

  const [floor, sponsors] = await Promise.all([
    getFloorContext(d.floor_id),
    getEventSponsors(d.event_id),
  ]);
  if (!floor) return null;

  return {
    device: {
      id: d.id,
      eventId: d.event_id,
      floorId: d.floor_id,
      name: d.name,
      enabled: d.enabled,
      sponsorsEnabled: d.sponsors_enabled,
      infoBlocksBetweenSponsors: d.info_blocks_between_sponsors,
    },
    blocks: toBlockSettings(d.display_blocks),
    sponsors: sponsors.filter((s) => s.display.enabled),
    heats: floor.heats,
    eventName: floor.eventName,
  };
}
