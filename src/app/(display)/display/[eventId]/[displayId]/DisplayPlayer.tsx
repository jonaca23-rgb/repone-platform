"use client";

import { useEffect, useRef, useState } from "react";
import { Appear } from "@/components/graphics/Appear";
import { DisplayStage } from "@/components/display/DisplayStage";
import { CurrentHeatBlock, NextHeatBlock } from "@/components/display/HeatBlock";
import { LeaderboardBlock } from "@/components/display/LeaderboardBlock";
import { SponsorAdBlock } from "@/components/display/SponsorAdBlock";
import { StandbyScreen } from "@/components/display/StandbyScreen";
import type { Database } from "@/lib/db/database.types";
import { currentAndNextHeat, eligibleInfoSlots } from "@/lib/display/eligibility";
import {
  INITIAL_SCHEDULER_STATE,
  nextItem,
  type PlaylistItem,
  type SchedulerState,
} from "@/lib/display/scheduler";
import type { DisplaySnapshot } from "@/lib/display/snapshot";
import { useBroadcastState } from "@/lib/realtime/useBroadcastState";
import { useDivisionStandings } from "@/lib/realtime/useDivisionStandings";
import { useRefreshOnChanges } from "@/lib/realtime/useRefreshOnChanges";

type BroadcastStateRow = Database["public"]["Tables"]["broadcast_state"]["Row"];

/** With nothing to show, or the display switched off, look again this often. */
const STANDBY_RETRY_MS = 5_000;

/**
 * The venue display's clock. Each time an item's time is up it asks the
 * scheduler for the next one, with whatever is eligible right now, so a heat
 * change, a removed sponsor or a new weight lands on the very next item
 * without restarting the rotation. The snapshot (device, blocks, sponsors,
 * heats) is re-read on the server when any of it changes; the floor's live
 * heat and the leaderboard come straight from Realtime.
 */
export function DisplayPlayer({
  snapshot,
  initialBroadcastState,
}: {
  snapshot: DisplaySnapshot;
  initialBroadcastState: BroadcastStateRow | null;
}) {
  const { device } = snapshot;
  useRefreshOnChanges([
    { table: "display_devices", filter: `id=eq.${device.id}` },
    { table: "display_blocks", filter: `display_id=eq.${device.id}` },
    { table: "event_sponsorships", filter: `event_id=eq.${device.eventId}` },
    { table: "sponsors" },
    { table: "sponsor_packages" },
    { table: "sponsor_creatives" },
    { table: "heats", filter: `floor_id=eq.${device.floorId}` },
  ]);

  const { state: broadcast, connected } = useBroadcastState(device.floorId, initialBroadcastState);
  const { current, next } = currentAndNextHeat(snapshot.heats, broadcast?.current_heat_id ?? null);
  const live = current && !current.endedAt ? current : null;
  const leaderboardDivision = (live ?? next ?? current)?.division ?? null;
  const standings = useDivisionStandings(leaderboardDivision?.id ?? null);

  // When Realtime dropped, so info blocks can be retired after five minutes.
  const wasConnected = useRef(false);
  const disconnectedSince = useRef<number | null>(null);
  useEffect(() => {
    if (connected) {
      wasConnected.current = true;
      disconnectedSince.current = null;
    } else if (wasConnected.current && disconnectedSince.current === null) {
      disconnectedSince.current = Date.now();
    }
  }, [connected]);

  // The timer reads the latest inputs without being reset by every refresh.
  const inputs = { snapshot, current, next, leaderboardRows: standings.rows.length };
  const latest = useRef(inputs);
  useEffect(() => {
    latest.current = inputs;
  });

  const scheduler = useRef<SchedulerState>(INITIAL_SCHEDULER_STATE);
  const [shown, setShown] = useState<{ item: PlaylistItem | null; n: number }>({
    item: null,
    n: 0,
  });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const advance = () => {
      const { snapshot: s, current: c, next: nx, leaderboardRows } = latest.current;
      if (!s.device.enabled) {
        setShown((prev) => ({ item: null, n: prev.n + 1 }));
        timer = setTimeout(advance, STANDBY_RETRY_MS);
        return;
      }
      const sponsors = s.device.sponsorsEnabled
        ? s.sponsors.map((sp) => ({
            sponsorshipId: sp.sponsorshipId,
            sponsorId: sp.sponsorId,
            durationSeconds: sp.display.durationSeconds,
            weight: sp.display.weight,
          }))
        : [];
      const info = eligibleInfoSlots({
        blocks: s.blocks,
        current: c,
        next: nx,
        leaderboardRows,
        disconnectedSinceMs: disconnectedSince.current,
        nowMs: Date.now(),
      });
      const r = nextItem(
        { sponsors, info, infoBetweenSponsors: s.device.infoBlocksBetweenSponsors },
        scheduler.current,
      );
      scheduler.current = r.state;
      setShown((prev) => ({ item: r.item, n: prev.n + 1 }));
      timer = setTimeout(advance, r.item ? r.item.slot.durationSeconds * 1000 : STANDBY_RETRY_MS);
    };
    timer = setTimeout(advance, 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <DisplayStage>
      <Appear key={shown.n} show variant="fade" className="absolute inset-0">
        {renderItem()}
      </Appear>
    </DisplayStage>
  );

  function renderItem() {
    const item = shown.item;
    if (!device.enabled || !item) return <StandbyScreen />;
    if (item.kind === "sponsor") {
      // A sponsorship removed mid-turn comes off at once.
      const sponsor = snapshot.sponsors.find((s) => s.sponsorshipId === item.slot.sponsorshipId);
      return sponsor ? <SponsorAdBlock sponsor={sponsor} /> : <StandbyScreen />;
    }
    if (item.slot.type === "current_heat" && live) {
      return <CurrentHeatBlock heat={live} eventName={snapshot.eventName} />;
    }
    if (item.slot.type === "next_heat" && next) {
      return <NextHeatBlock heat={next} eventName={snapshot.eventName} />;
    }
    if (item.slot.type === "leaderboard" && leaderboardDivision && standings.rows.length > 0) {
      return (
        <LeaderboardBlock
          division={leaderboardDivision.name}
          rows={standings.rows}
          eventName={snapshot.eventName}
        />
      );
    }
    return <StandbyScreen />;
  }
}
