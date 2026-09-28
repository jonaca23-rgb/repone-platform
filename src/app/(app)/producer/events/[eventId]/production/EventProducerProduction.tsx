"use client";

import { useState } from "react";
import { DashboardClient } from "@/app/(app)/dashboard/[floorId]/DashboardClient";
import type { EventLiveFloor } from "@/lib/db/queries";

// Same "floor tabs instead of a floor URL segment" pattern as
// commentator/events/[eventId]/dashboard/EventCommentatorDashboard.tsx —
// most events run one floor at a time, so this is a lightweight wrapper
// around the existing, already-built Production Dashboard (DashboardClient)
// rather than a rewrite of it.
export function EventProducerProduction({
  eventId,
  eventName,
  floors,
  sponsors,
}: {
  eventId: string;
  eventName: string;
  floors: EventLiveFloor[];
  sponsors: Array<{ id: string; business_name: string; tier: string }>;
}) {
  const [selectedFloorId, setSelectedFloorId] = useState(floors[0]?.floorId ?? null);
  const selectedFloor = floors.find((f) => f.floorId === selectedFloorId) ?? floors[0] ?? null;

  if (!selectedFloor) {
    return <p className="py-12 text-center text-white/50">No floors set up for this event yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {floors.length > 1 && (
        <div className="flex flex-wrap gap-2 px-4 pt-4">
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
      <DashboardClient
        floorId={selectedFloor.floorId}
        eventId={eventId}
        eventName={eventName}
        heats={selectedFloor.heats}
        initialBroadcastState={selectedFloor.initialBroadcastState}
        sponsors={sponsors}
      />
    </div>
  );
}
