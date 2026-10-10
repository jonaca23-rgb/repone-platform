/**
 * The venue display's playlist scheduler (docs/specs/venue-display.md "Weighted scheduler").
 * Pure: the player keeps the state and calls nextItem() each time an item
 * ends, with whatever is eligible right now, so a heat change, a removed
 * sponsor or a new weight takes effect on the very next item.
 *
 * Sponsors and info blocks are each picked by smooth weighted round-robin:
 * exact proportions over every cycle of sum(weights) picks, with heavy
 * sponsors spread evenly instead of bunched. Credits for slots that are no
 * longer eligible are dropped.
 */

export type InfoBlockType = "current_heat" | "next_heat" | "leaderboard";
export interface SponsorSlot {
  sponsorshipId: string;
  sponsorId: string;
  durationSeconds: number;
  weight: number;
}
export interface InfoSlot {
  type: InfoBlockType;
  durationSeconds: number;
  weight: number;
}
export type PlaylistItem =
  | { kind: "sponsor"; slot: SponsorSlot }
  | { kind: "info"; slot: InfoSlot };

export interface SchedulerState {
  sponsorCredit: Record<string, number>;
  infoCredit: Record<string, number>;
  lastSponsorId: string | null;
  infoSinceSponsor: number;
}

export const INITIAL_SCHEDULER_STATE: SchedulerState = {
  sponsorCredit: {},
  infoCredit: {},
  lastSponsorId: null,
  // Start with a sponsor: the first thing on a freshly booted screen.
  infoSinceSponsor: Number.POSITIVE_INFINITY,
};

function pickWeighted<T>(
  items: T[],
  key: (t: T) => string,
  weight: (t: T) => number,
  credit: Record<string, number>,
  skip: (t: T) => boolean,
): { picked: T; credit: Record<string, number> } {
  const next: Record<string, number> = {};
  let total = 0;
  for (const it of items) {
    const w = Math.max(1, weight(it));
    next[key(it)] = (credit[key(it)] ?? 0) + w;
    total += w;
  }
  const ranked = [...items].sort(
    (a, b) => next[key(b)] - next[key(a)] || key(a).localeCompare(key(b)),
  );
  const picked = ranked.find((it) => !skip(it)) ?? ranked[0];
  next[key(picked)] -= total;
  return { picked, credit: next };
}

export function nextItem(
  input: { sponsors: SponsorSlot[]; info: InfoSlot[]; infoBetweenSponsors: number },
  state: SchedulerState,
): { item: PlaylistItem | null; state: SchedulerState } {
  const { sponsors, info, infoBetweenSponsors } = input;
  if (sponsors.length === 0 && info.length === 0) return { item: null, state };

  const sponsorTurn =
    sponsors.length > 0 && (info.length === 0 || state.infoSinceSponsor >= infoBetweenSponsors);

  if (sponsorTurn) {
    const { picked, credit } = pickWeighted(
      sponsors,
      (s) => s.sponsorshipId,
      (s) => s.weight,
      state.sponsorCredit,
      (s) => s.sponsorId === state.lastSponsorId,
    );
    return {
      item: { kind: "sponsor", slot: picked },
      state: {
        ...state,
        sponsorCredit: credit,
        lastSponsorId: picked.sponsorId,
        infoSinceSponsor: 0,
      },
    };
  }

  const { picked, credit } = pickWeighted(
    info,
    (i) => i.type,
    (i) => i.weight,
    state.infoCredit,
    () => false,
  );
  return {
    item: { kind: "info", slot: picked },
    state: {
      ...state,
      infoCredit: credit,
      lastSponsorId: null,
      infoSinceSponsor: state.infoSinceSponsor + 1,
    },
  };
}
