"use client";

import { useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/db/client";

export interface TableWatch {
  table:
    | "heats"
    | "lanes"
    | "results"
    | "standings"
    | "messages"
    | "display_devices"
    | "display_blocks"
    | "event_sponsorships"
    | "sponsors"
    | "sponsor_packages"
    | "sponsor_creatives";
  /** Realtime filter, e.g. "floor_id=eq.<id>" or "heat_id=in.(<id>,<id>)". */
  filter?: string;
  /** Which changes count; every change by default. */
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
}

/**
 * Re-renders the page from the server (router.refresh) when any watched table
 * changes, so screens that load heats/lanes/results once — OBS overlays, the
 * production dashboard, a second scorekeeper — pick up edits made elsewhere
 * without anyone reloading them. Bursts (a heat generated with 8 lanes, a
 * standings rewrite) collapse into one refresh.
 *
 * Uncontrolled form inputs keep what's been typed across a refresh: React
 * reconciles the same keyed elements and leaves their DOM values alone.
 */
export function useRefreshOnChanges(watches: TableWatch[], debounceMs = 400) {
  const router = useRouter();
  const instanceId = useId();
  const signature = JSON.stringify(watches.map((w) => [w.table, w.filter ?? null, w.event ?? "*"]));

  useEffect(() => {
    if (signature === "[]") return;
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), debounceMs);
    };

    let channel = supabase.channel(`refresh:${instanceId}`);
    const parts = JSON.parse(signature) as Array<[string, string | null, string]>;
    for (const [table, filter, event] of parts) {
      channel = channel.on(
        "postgres_changes",
        // The overloads key on a literal event; "*" stands in for any of them.
        { event: event as "*", schema: "public", table, ...(filter ? { filter } : {}) },
        schedule,
      );
    }
    channel.subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [signature, instanceId, router, debounceMs]);
}
