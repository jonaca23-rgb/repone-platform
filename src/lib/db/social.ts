import { createClient } from "@/lib/db/server";
import { LIFT_LABELS, isTimeLift, type LiftName } from "@/lib/constants/lifts";
import { formatClock } from "@/lib/timer/compute";
import { resolveCounterparts } from "@/lib/db/messages";
import type { LikeTargetType } from "@/lib/db/database.types";

// ---------------------------------------------------------------------------
// Likes — generic count + "did I like this" lookup, shared by lifts,
// benchmarks, and standings (competition results).
// ---------------------------------------------------------------------------

interface LikeInfo {
  count: number;
  likedByMe: boolean;
}

async function getLikesFor(targetType: LikeTargetType, targetIds: string[], viewerUserId: string | null): Promise<Map<string, LikeInfo>> {
  const map = new Map<string, LikeInfo>();
  if (targetIds.length === 0) return map;

  const supabase = await createClient();
  const { data } = await supabase
    .from("athlete_likes")
    .select("target_id, liker_user_id")
    .eq("target_type", targetType)
    .in("target_id", targetIds);

  for (const row of data ?? []) {
    const entry = map.get(row.target_id) ?? { count: 0, likedByMe: false };
    entry.count += 1;
    if (viewerUserId && row.liker_user_id === viewerUserId) entry.likedByMe = true;
    map.set(row.target_id, entry);
  }
  return map;
}

/** Toggle-friendly display helper — never leaks who liked what, just the count + mine. */
function likeInfoFor(map: Map<string, LikeInfo>, id: string): LikeInfo {
  return map.get(id) ?? { count: 0, likedByMe: false };
}

// ---------------------------------------------------------------------------
// Lifts & benchmarks — now readable by any org member (0017_athlete_likes_
// and_roster_add.sql), not just staff.
// ---------------------------------------------------------------------------

export interface LiftEntry {
  id: string;
  lift: LiftName;
  label: string;
  valueDisplay: string;
  like: LikeInfo;
}

export interface BenchmarkEntry {
  id: string;
  name: string;
  resultDisplay: string;
  like: LikeInfo;
}

export async function getAthleteLiftsAndBenchmarks(
  athleteId: string,
  viewerUserId: string | null
): Promise<{ lifts: LiftEntry[]; benchmarks: BenchmarkEntry[] }> {
  const supabase = await createClient();
  const [{ data: liftRows }, { data: benchmarkRows }] = await Promise.all([
    supabase.from("athlete_lifts").select("id, lift, weight_lbs, time_seconds").eq("athlete_id", athleteId),
    supabase.from("athlete_benchmarks").select("id, name, result_display").eq("athlete_id", athleteId).order("name"),
  ]);

  const [liftLikes, benchmarkLikes] = await Promise.all([
    getLikesFor("lift", (liftRows ?? []).map((l) => l.id), viewerUserId),
    getLikesFor("benchmark", (benchmarkRows ?? []).map((b) => b.id), viewerUserId),
  ]);

  const lifts: LiftEntry[] = (liftRows ?? []).map((l) => {
    const lift = l.lift as LiftName;
    const valueDisplay = isTimeLift(lift) ? formatClock(l.time_seconds ?? 0) : `${l.weight_lbs} lbs`;
    return { id: l.id, lift, label: LIFT_LABELS[lift] ?? lift, valueDisplay, like: likeInfoFor(liftLikes, l.id) };
  });

  const benchmarks: BenchmarkEntry[] = (benchmarkRows ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    resultDisplay: b.result_display,
    like: likeInfoFor(benchmarkLikes, b.id),
  }));

  return { lifts, benchmarks };
}

/** Same shape helper for standings (competition-history) likes — used on the
 * directory profile page alongside getAthleteCompetitionHistory. */
export async function getStandingLikes(standingIds: string[], viewerUserId: string | null): Promise<Map<string, LikeInfo>> {
  return getLikesFor("standing", standingIds, viewerUserId);
}

// ---------------------------------------------------------------------------
// Current leaderboard status — for the athlete's personal dashboard.
// ---------------------------------------------------------------------------

export interface CurrentStanding {
  eventName: string;
  eventStatus: string;
  divisionName: string;
  placement: number | null;
  points: number | null;
}

/**
 * Picks the athlete's most relevant current standing to show on their
 * dashboard: prefers a `live` event they're registered in over anything
 * else, then falls back to their most recently started event. Returns null
 * if they aren't registered anywhere or nothing's been scored yet.
 */
export async function getAthleteCurrentStanding(athleteId: string): Promise<CurrentStanding | null> {
  const supabase = await createClient();
  const { data: registrations } = await supabase
    .from("registrations")
    .select("event_id, division_id, events(id, name, status, starts_on), divisions(id, name)")
    .eq("athlete_id", athleteId);

  const rows = (registrations ?? []) as unknown as Array<{
    event_id: string;
    division_id: string;
    events: { id: string; name: string; status: string; starts_on: string | null } | null;
    divisions: { id: string; name: string } | null;
  }>;
  if (rows.length === 0) return null;

  const withEvents = rows.filter((r) => r.events);
  const live = withEvents.find((r) => r.events!.status === "live");
  const chosen =
    live ??
    withEvents.sort((a, b) => (b.events!.starts_on ?? "").localeCompare(a.events!.starts_on ?? ""))[0] ??
    null;
  if (!chosen || !chosen.events) return null;

  const { data: standing } = await supabase
    .from("standings")
    .select("placement, points")
    .eq("athlete_id", athleteId)
    .eq("event_id", chosen.event_id)
    .eq("division_id", chosen.division_id)
    .is("wod_id", null)
    .maybeSingle();

  return {
    eventName: chosen.events.name,
    eventStatus: chosen.events.status,
    divisionName: chosen.divisions?.name ?? "—",
    placement: standing?.placement ?? null,
    points: standing?.points ?? null,
  };
}

// ---------------------------------------------------------------------------
// Recent activity feed — likes received + messages received, merged, for the
// athlete's personal dashboard.
// ---------------------------------------------------------------------------

export interface ActivityItem {
  id: string;
  type: "like" | "message";
  createdAt: string;
  actorName: string;
  description: string;
}

async function describeLikeTargets(likes: { id: string; target_type: LikeTargetType; target_id: string }[]): Promise<Map<string, string>> {
  const supabase = await createClient();
  const descriptions = new Map<string, string>();

  const liftIds = likes.filter((l) => l.target_type === "lift").map((l) => l.target_id);
  const benchmarkIds = likes.filter((l) => l.target_type === "benchmark").map((l) => l.target_id);
  const standingIds = likes.filter((l) => l.target_type === "standing").map((l) => l.target_id);

  const [{ data: lifts }, { data: benchmarks }, { data: standings }] = await Promise.all([
    liftIds.length ? supabase.from("athlete_lifts").select("id, lift").in("id", liftIds) : Promise.resolve({ data: [] as { id: string; lift: string }[] }),
    benchmarkIds.length
      ? supabase.from("athlete_benchmarks").select("id, name").in("id", benchmarkIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    standingIds.length
      ? supabase.from("standings").select("id, event_id, wod_id").in("id", standingIds)
      : Promise.resolve({ data: [] as { id: string; event_id: string; wod_id: string | null }[] }),
  ]);

  for (const l of lifts ?? []) {
    descriptions.set(l.id, `your ${LIFT_LABELS[l.lift as LiftName] ?? l.lift} PR`);
  }
  for (const b of benchmarks ?? []) {
    descriptions.set(b.id, `your ${b.name} time`);
  }

  if ((standings ?? []).length > 0) {
    const eventIds = [...new Set((standings ?? []).map((s) => s.event_id))];
    const wodIds = [...new Set((standings ?? []).flatMap((s) => (s.wod_id ? [s.wod_id] : [])))];
    const [{ data: events }, { data: wods }] = await Promise.all([
      supabase.from("events").select("id, name").in("id", eventIds),
      wodIds.length ? supabase.from("wods").select("id, name").in("id", wodIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);
    const eventById = new Map((events ?? []).map((e) => [e.id, e.name]));
    const wodById = new Map((wods ?? []).map((w) => [w.id, w.name]));
    for (const s of standings ?? []) {
      const eventName = eventById.get(s.event_id) ?? "an event";
      descriptions.set(s.id, s.wod_id ? `your ${wodById.get(s.wod_id) ?? "WOD"} result at ${eventName}` : `your overall placement at ${eventName}`);
    }
  }

  return descriptions;
}

export async function getRecentActivity(athleteId: string, userId: string, organizationId: string, limit = 10): Promise<ActivityItem[]> {
  const supabase = await createClient();

  const [{ data: likeRows }, { data: messageRows }] = await Promise.all([
    supabase
      .from("athlete_likes")
      .select("id, liker_user_id, target_type, target_id, created_at")
      .eq("athlete_id", athleteId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("messages")
      .select("id, sender_id, body, created_at")
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  const likes = likeRows ?? [];
  const messages = messageRows ?? [];

  const actorIds = [...new Set([...likes.map((l) => l.liker_user_id), ...messages.map((m) => m.sender_id)])];
  const [actorLabels, targetDescriptions] = await Promise.all([
    resolveCounterparts(actorIds, organizationId),
    describeLikeTargets(likes),
  ]);

  const likeItems: ActivityItem[] = likes.map((l) => ({
    id: `like:${l.id}`,
    type: "like" as const,
    createdAt: l.created_at,
    actorName: actorLabels.get(l.liker_user_id)?.name ?? "Someone",
    description: `liked ${targetDescriptions.get(l.target_id) ?? "your result"}`,
  }));

  const messageItems: ActivityItem[] = messages.map((m) => ({
    id: `message:${m.id}`,
    type: "message" as const,
    createdAt: m.created_at,
    actorName: actorLabels.get(m.sender_id)?.name ?? "Someone",
    description: m.body,
  }));

  return [...likeItems, ...messageItems].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}
