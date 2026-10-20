import type { Metadata } from "next";
import { createClient } from "@/lib/db/server";
import type { InfoBlockType } from "@/lib/display/scheduler";
import { toBlockSettings } from "@/lib/display/toBlockSettings";
import { PageHeader } from "@/components/app/PageHeader";
import { producerEventTitle } from "../producerEvent";
import { type DisplayRow, DisplaysTable } from "./DisplaysTable";

type Props = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: await producerEventTitle((await params).eventId, "Displays") };
}

interface RawDisplay {
  id: string;
  name: string;
  floor_id: string;
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

/**
 * The event's venue displays: the portrait TVs that rotate its sponsors with
 * the heat on a floor and the leaderboard. Each one opens at its own URL in
 * a kiosk browser, signed out.
 */
export default async function ProducerEventDisplaysPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const [displays, venues] = await Promise.all([
    supabase
      .from("display_devices")
      .select(
        "id, name, floor_id, enabled, sponsors_enabled, info_blocks_between_sponsors, display_blocks(block_type, enabled, duration_seconds, weight)",
      )
      .eq("event_id", eventId)
      .order("created_at"),
    supabase.from("venues").select("name, floors(id, name, sort_order)").eq("event_id", eventId),
  ]);
  if (displays.error) throw new Error(displays.error.message);
  if (venues.error) throw new Error(venues.error.message);

  const multipleVenues = (venues.data ?? []).length > 1;
  const floors = (venues.data ?? []).flatMap((v) =>
    [...v.floors]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((f) => ({ id: f.id, name: multipleVenues ? `${v.name} · ${f.name}` : f.name })),
  );
  const floorName = new Map(floors.map((f) => [f.id, f.name]));

  const rows: DisplayRow[] = ((displays.data ?? []) as unknown as RawDisplay[]).map((d) => ({
    id: d.id,
    name: d.name,
    floorName: floorName.get(d.floor_id) ?? "Unknown floor",
    enabled: d.enabled,
    sponsorsEnabled: d.sponsors_enabled,
    infoBlocksBetweenSponsors: d.info_blocks_between_sponsors,
    blocks: toBlockSettings(d.display_blocks),
  }));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <PageHeader
        title="Displays"
        description="Portrait TVs at the venue. Each rotates the event's sponsors with the heat on its floor and the leaderboard."
      />
      <DisplaysTable eventId={eventId} rows={rows} floors={floors} />
    </div>
  );
}
