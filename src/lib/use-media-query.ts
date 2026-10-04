"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether a CSS media query currently matches.
 *
 * For the cases where the difference between layouts is structural rather than
 * cosmetic — an inline panel on a desktop grid versus a drawer on a phone —
 * and so cannot be expressed as a class that hides one of two mounted copies:
 * mounting both would duplicate the forms, their element ids and their
 * mutations.
 *
 * The server snapshot is false because there is no viewport to measure during
 * a server render. Nothing here renders before the first interaction, so the
 * correction on hydration is never visible.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    // A boolean, deliberately: useSyncExternalStore compares snapshots with
    // Object.is, so a selector returning a fresh object would loop forever.
    () => window.matchMedia(query).matches,
    () => false,
  );
}
