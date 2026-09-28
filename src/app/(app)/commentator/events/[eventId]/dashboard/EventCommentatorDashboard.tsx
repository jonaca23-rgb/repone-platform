"use client";

import { useState } from "react";
import { CommentatorClient } from "@/app/(app)/commentator/[floorId]/CommentatorClient";
import type { CommentatorAthleteDetails } from "@/lib/db/commentator";
import type { EventLiveFloor } from "@/lib/db/queries";

// The event-level Commentator Dashboard (per Jonathan's route spec,
// /commentator/events/[eventId]/dashboard): floor selection becomes an
// in-page tab instead of a separate route/page, since most events run one
// floor at a time — an event with several simultaneous floors gets a
// lightweight tab strip here rather than a URL segment. Everything below
// the tabs is the same, already-built CommentatorClient used by the
// standalone /commentator/[floorId] route, just with its own
// "choose a different floor" link hidden (this page already has an
// equivalent, event-scoped nav one level up).
export function EventCommentatorDashboard({
  eventName,
  floors,
  detailsByAthleteId,
}: {
  eventName: string;
  floors: EventLiveFloor[];
  detailsByAthleteId: Record<string, CommentatorAthleteDetails>;
}) {
  const [selectedFloorId, setSelectedFloorId] = useState(floors[0]?.floorId ?? null);
  const selectedFloor = floors.find((f) => f.floorId === selectedFloorId) ?? floors[0] ?? null;

  if (!selectedFloor) {
    return <p className="py-12 text-center text-white/50">No floors set up for this event yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {floors.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {floors.map((f) => (
            <button
              key={f.floorId}
              type="button"
              onClick={() => setSelectedFloorId(f.floorId)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
                f.floorId === selectedFloor.floorId
                  ? "bg-repone-red text-white"
                  : "bg-white/10 text-white/60 hover:bg-white/20"
              }`}
            >
              {f.venueName} — {f.floorName}
            </button>
          ))}
        </div>
      )}
      <CommentatorClient
        floorId={selectedFloor.floorId}
        eventName={eventName}
        heats={selectedFloor.heats}
        initialBroadcastState={selectedFloor.initialBroadcastState}
        detailsByAthleteId={detailsByAthleteId}
        hideBackLink
      />
    </div>
  );
}
