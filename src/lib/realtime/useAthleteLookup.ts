"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/db/client";

export interface AthleteLookup {
  name: string;
  affiliate: string | null;
  division: string | null;
}

/** Resolves an athlete id (as selected for the Lower Third) to display fields. */
export function useAthleteLookup(athleteId: string | null, eventId: string): AthleteLookup | null {
  const [athlete, setAthlete] = useState<AthleteLookup | null>(null);

  useEffect(() => {
    if (!athleteId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when the selection is cleared
      setAthlete(null);
      return;
    }
    let cancelled = false;
    const supabase = createClient();

    async function load() {
      const [{ data: a }, { data: regRaw }] = await Promise.all([
        supabase.from("athletes").select("first_name, last_name, affiliate").eq("id", athleteId!).maybeSingle(),
        supabase
          .from("registrations")
          .select("divisions(name)")
          .eq("athlete_id", athleteId!)
          .eq("event_id", eventId)
          .maybeSingle(),
      ]);
      // See lib/db/queries.ts header comment: cast the many-to-one embed back to a single object.
      const reg = regRaw as unknown as { divisions: { name: string } | null } | null;
      if (!cancelled && a) {
        setAthlete({
          name: `${a.first_name} ${a.last_name}`,
          affiliate: a.affiliate,
          division: reg?.divisions?.name ?? null,
        });
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [athleteId, eventId]);

  return athlete;
}
