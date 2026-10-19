import { getAthletePrivateDetails } from "@/lib/db/athletePrivate";
import {
  type AthleteHistoryGroup,
  groupCompetitionHistory,
  type HistoryStandingRow,
} from "@/lib/athlete/competitionHistory";
import { createClient } from "@/lib/db/server";
import { computeAgeCategory, type AgeCategory, type Gender } from "@/lib/scoring/ageCategory";
import { ROLE_LABELS } from "@/lib/constants/roles";
import type { Database } from "@/lib/db/database.types";
import { splitRoles } from "@/lib/auth/permissions";

type MessageRow = Database["public"]["Tables"]["messages"]["Row"];

// ---------------------------------------------------------------------------
// Athlete directory — "other athletes' info" on the athlete's own profile.
// ---------------------------------------------------------------------------

export interface DirectoryAthlete {
  id: string;
  firstName: string;
  lastName: string;
  affiliate: string | null;
  photoUrl: string | null;
  authUserId: string | null; // null = hasn't created a RepOne account, can't be messaged
}

export async function getAthleteDirectory(
  organizationId: string,
  excludeAthleteId: string,
): Promise<DirectoryAthlete[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("athletes")
    .select("id, first_name, last_name, affiliate, photo_url, auth_user_id")
    .eq("organization_id", organizationId)
    .neq("id", excludeAthleteId)
    .order("first_name");

  return (data ?? []).map((a) => ({
    id: a.id,
    firstName: a.first_name,
    lastName: a.last_name,
    affiliate: a.affiliate,
    photoUrl: a.photo_url,
    authUserId: a.auth_user_id,
  }));
}

export interface AthleteProfile {
  id: string;
  firstName: string;
  lastName: string;
  affiliate: string | null;
  photoUrl: string | null;
  ageCategory: AgeCategory | null; // computed server-side; raw date of birth is never returned
  authUserId: string | null;
}

export async function getAthleteProfile(
  athleteId: string,
  organizationId: string,
): Promise<AthleteProfile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("athletes")
    .select("id, first_name, last_name, affiliate, photo_url, gender, auth_user_id")
    .eq("id", athleteId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!data) return null;
  // Date of birth is only returned to staff or the athlete themselves, so
  // another athlete viewing this profile sees no age category.
  const dateOfBirth = (await getAthletePrivateDetails(supabase, [athleteId])).get(
    athleteId,
  )?.dateOfBirth;

  return {
    id: data.id,
    firstName: data.first_name,
    lastName: data.last_name,
    affiliate: data.affiliate,
    photoUrl: data.photo_url,
    ageCategory: computeAgeCategory(dateOfBirth, data.gender as Gender | null, new Date()),
    authUserId: data.auth_user_id,
  };
}

export type { AthleteHistoryGroup };

/**
 * An athlete's results by event, their own and those of the teams they were
 * on (0036), for the athlete portal, the directory profile and the
 * commentator's cards. Standings and results are public-read (0002), so
 * anyone signed in can see them. Grouping: groupCompetitionHistory.
 */
export async function getAthleteCompetitionHistory(
  athleteId: string,
): Promise<AthleteHistoryGroup[]> {
  const supabase = await createClient();
  const columns = "id, event_id, division_id, wod_id, team_id, placement, points, teams(name)";
  const [own, memberships] = await Promise.all([
    supabase.from("standings").select(columns).eq("athlete_id", athleteId),
    supabase.from("team_members").select("team_id").eq("athlete_id", athleteId),
  ]);
  if (own.error) throw new Error(own.error.message);
  if (memberships.error) throw new Error(memberships.error.message);
  const teamIds = (memberships.data ?? []).map((m) => m.team_id);
  const ofTeams = teamIds.length
    ? await supabase.from("standings").select(columns).in("team_id", teamIds)
    : { data: [], error: null };
  if (ofTeams.error) throw new Error(ofTeams.error.message);

  const rows = [...(own.data ?? []), ...(ofTeams.data ?? [])] as unknown as HistoryStandingRow[];
  const eventIds = [...new Set(rows.map((r) => r.event_id))];
  const divisionIds = [...new Set(rows.map((r) => r.division_id))];
  const wodIds = [...new Set(rows.flatMap((r) => (r.wod_id ? [r.wod_id] : [])))];

  const [events, divisions, wods] = await Promise.all([
    eventIds.length
      ? supabase.from("events").select("id, name, starts_on").in("id", eventIds)
      : Promise.resolve({ data: [], error: null }),
    divisionIds.length
      ? supabase.from("divisions").select("id, name").in("id", divisionIds)
      : Promise.resolve({ data: [], error: null }),
    wodIds.length
      ? supabase.from("wods").select("id, name, sort_order").in("id", wodIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  return groupCompetitionHistory(rows, {
    events: events.data ?? [],
    divisions: divisions.data ?? [],
    wods: wods.data ?? [],
  });
}

// ---------------------------------------------------------------------------
// Org staff directory — so an athlete has someone to pick when starting a
// conversation with "an admin/staff member."
// ---------------------------------------------------------------------------

export interface StaffContact {
  userId: string;
  fullName: string;
  roleLabels: string[];
}

export async function getOrgStaffDirectory(organizationId: string): Promise<StaffContact[]> {
  const supabase = await createClient();
  const { data: memberRows } = await supabase
    .from("member")
    .select("user_id, role")
    .eq("organization_id", organizationId);

  const userIds = [...new Set((memberRows ?? []).map((r) => r.user_id))];
  if (userIds.length === 0) return [];

  const rolesByUser = new Map((memberRows ?? []).map((r) => [r.user_id, splitRoles(r.role)]));

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds);

  return userIds
    .map((id) => ({
      userId: id,
      fullName: profiles?.find((p) => p.id === id)?.full_name || "Staff member",
      roleLabels: (rolesByUser.get(id) ?? []).map((r) => ROLE_LABELS[r]),
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

// ---------------------------------------------------------------------------
// Messaging — conversations, threads, unread counts.
// ---------------------------------------------------------------------------

export interface ConversationSummary {
  counterpartId: string;
  counterpartName: string;
  counterpartKind: "athlete" | "staff";
  counterpartSublabel: string | null;
  lastMessage: string;
  lastMessageAt: string;
  lastMessageFromMe: boolean;
  unreadCount: number;
}

interface CounterpartLabel {
  name: string;
  kind: "athlete" | "staff";
  sublabel: string | null;
}

/**
 * Resolves a batch of auth.users ids to a display name + "athlete" or
 * "staff" — used to label conversation list entries and thread headers,
 * since `messages` only stores raw auth user ids and either side of a
 * conversation could be either kind of account.
 */
export async function resolveCounterparts(
  userIds: string[],
  organizationId: string,
): Promise<Map<string, CounterpartLabel>> {
  const map = new Map<string, CounterpartLabel>();
  if (userIds.length === 0) return map;

  const supabase = await createClient();
  const { data: athletes } = await supabase
    .from("athletes")
    .select("auth_user_id, first_name, last_name, affiliate")
    .eq("organization_id", organizationId)
    .in("auth_user_id", userIds);

  for (const a of athletes ?? []) {
    if (a.auth_user_id) {
      map.set(a.auth_user_id, {
        name: `${a.first_name} ${a.last_name}`,
        kind: "athlete",
        sublabel: a.affiliate,
      });
    }
  }

  const remaining = userIds.filter((id) => !map.has(id));
  if (remaining.length > 0) {
    const [{ data: profiles }, { data: memberRows }] = await Promise.all([
      supabase.from("profiles").select("id, full_name").in("id", remaining),
      supabase
        .from("member")
        .select("user_id, role")
        .eq("organization_id", organizationId)
        .in("user_id", remaining),
    ]);

    const rolesByUser = new Map((memberRows ?? []).map((r) => [r.user_id, splitRoles(r.role)]));

    for (const id of remaining) {
      const profile = profiles?.find((p) => p.id === id);
      const roles = (rolesByUser.get(id) ?? []).map((r) => ROLE_LABELS[r]);
      map.set(id, {
        name: profile?.full_name || "Staff member",
        kind: "staff",
        sublabel: roles.join(", ") || null,
      });
    }
  }

  return map;
}

export async function getConversations(
  myUserId: string,
  organizationId: string,
): Promise<ConversationSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select("id, sender_id, recipient_id, body, read_at, created_at")
    .or(`sender_id.eq.${myUserId},recipient_id.eq.${myUserId}`)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as MessageRow[];

  const byCounterpart = new Map<string, { last: MessageRow; unread: number }>();
  for (const m of rows) {
    const counterpartId = m.sender_id === myUserId ? m.recipient_id : m.sender_id;
    const isUnreadForMe = m.recipient_id === myUserId && m.read_at === null;
    const entry = byCounterpart.get(counterpartId);
    if (!entry) {
      // Rows are already ordered newest-first, so the first one seen per
      // counterpart is the most recent message in that thread.
      byCounterpart.set(counterpartId, { last: m, unread: isUnreadForMe ? 1 : 0 });
    } else if (isUnreadForMe) {
      entry.unread += 1;
    }
  }

  const counterpartIds = [...byCounterpart.keys()];
  const labels = await resolveCounterparts(counterpartIds, organizationId);

  return counterpartIds
    .map((id) => {
      const entry = byCounterpart.get(id)!;
      const label = labels.get(id);
      return {
        counterpartId: id,
        counterpartName: label?.name ?? "Unknown",
        counterpartKind: label?.kind ?? ("athlete" as const),
        counterpartSublabel: label?.sublabel ?? null,
        lastMessage: entry.last.body,
        lastMessageAt: entry.last.created_at,
        lastMessageFromMe: entry.last.sender_id === myUserId,
        unreadCount: entry.unread,
      };
    })
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}

export interface MessageItem {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  fromMe: boolean;
}

export async function getThread(myUserId: string, counterpartId: string): Promise<MessageItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select("id, sender_id, recipient_id, body, read_at, created_at")
    .or(
      `and(sender_id.eq.${myUserId},recipient_id.eq.${counterpartId}),and(sender_id.eq.${counterpartId},recipient_id.eq.${myUserId})`,
    )
    .order("created_at", { ascending: true });

  return ((data ?? []) as MessageRow[]).map((m) => ({
    id: m.id,
    senderId: m.sender_id,
    recipientId: m.recipient_id,
    body: m.body,
    createdAt: m.created_at,
    readAt: m.read_at,
    fromMe: m.sender_id === myUserId,
  }));
}

export async function getUnreadCount(myUserId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", myUserId)
    .is("read_at", null);
  return count ?? 0;
}

/** Marks every unread message FROM counterpartId TO myUserId as read. Called
 * from the thread page itself (a plain read-side effect of viewing it, not a
 * user-triggered form submission), so this isn't a "use server" action. */
export async function markThreadRead(myUserId: string, counterpartId: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", myUserId)
    .eq("sender_id", counterpartId)
    .is("read_at", null);
}
