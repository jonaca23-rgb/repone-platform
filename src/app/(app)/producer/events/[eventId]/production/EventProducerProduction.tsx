"use client";

import { useState } from "react";
import { MapPinOff } from "lucide-react";
import { DashboardClient } from "@/app/(app)/dashboard/[floorId]/DashboardClient";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
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
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <EmptyState
          icon={MapPinOff}
          title="No floors set up for this event yet"
          description="Add a venue and its floors in Admin → Venues."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {floors.length > 1 && (
        <div
          role="group"
          aria-label="Floor"
          className="mx-auto flex w-full max-w-5xl flex-wrap gap-2 px-4 pt-4"
        >
          {floors.map((f) => {
            const selected = f.floorId === selectedFloor.floorId;
            return (
              <Button
                key={f.floorId}
                type="button"
                size="touch"
                variant={selected ? "default" : "secondary"}
                aria-pressed={selected}
                onClick={() => setSelectedFloorId(f.floorId)}
              >
                {f.venueName} — {f.floorName}
              </Button>
            );
          })}
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
