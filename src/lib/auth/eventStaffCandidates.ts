import { createClient } from "@/lib/db/server";

// Who can an admin assign as an event's Scorekeeper/Producer/Commentator?
// Per Jonathan: not just existing staff accounts (today that's only ever
// the admin themselves — there's still no separate staff invite flow, see
// architecture/rbac-audit-and-plan.md) but also any ATHLETE who already has
// a real Supabase Auth account (athletes.auth_user_id set, from signing up
// through the Athlete Portal). Nothing about the assignment tables
// (0024_event_role_assignments.sql) cares whether the assigned user_id
// belongs to a "staff" profile or an athlete — is_event_scorekeeper() etc.
// just check auth.uid() against the assignment row — so this is a UI-layer
// widening of the candidate pool, not a schema change: someone who is both
// a competing athlete and, say, running the scoreboard for a friend's heat
// is a normal thing for a small operation like Jonathan's to want.

export interface StaffCandidate {
  userId: string;
  label: string;
  source: "staff" | "athlete";
}

export async function getEventStaffCandidates(
  organizationId: string | null,
): Promise<StaffCandidate[]> {
  if (!organizationId) return [];
  const supabase = await createClient();

  const [{ data: profiles }, { data: athletes }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("organization_id", organizationId)
      .order("full_name"),
    supabase
      .from("athletes")
      .select("auth_user_id, first_name, last_name")
      .eq("organization_id", organizationId)
      .not("auth_user_id", "is", null)
      .order("last_name"),
  ]);

  const candidates: StaffCandidate[] = [];
  const seen = new Set<string>();

  for (const p of profiles ?? []) {
    candidates.push({
      userId: p.id,
      label: `${p.full_name || "Unnamed staff account"} (Staff)`,
      source: "staff",
    });
    seen.add(p.id);
  }
  for (const a of athletes ?? []) {
    const userId = a.auth_user_id as string;
    // A person could in principle be both (an admin who's also a competing
    // athlete) — keep the staff entry, since that's the account they'd
    // actually be signing in through for staff work.
    if (seen.has(userId)) continue;
    candidates.push({
      userId,
      label: `${a.first_name} ${a.last_name} (Athlete)`,
      source: "athlete",
    });
    seen.add(userId);
  }

  return candidates;
}

/**
 * Best display name for a user_id that may belong to either a staff profile
 * or an athlete account — prefers the athlete's name (first_name/last_name
 * is always populated for a real athlete row; a staff profile's full_name
 * is only ever set if entered manually, and often isn't for a
 * self-registered athlete-turned-staff account).
 */
export async function getDisplayNamesByUserId(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const supabase = await createClient();

  const [{ data: profiles }, { data: athletes }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").in("id", userIds),
    supabase
      .from("athletes")
      .select("auth_user_id, first_name, last_name")
      .in("auth_user_id", userIds),
  ]);

  const nameById = new Map<string, string>();
  for (const p of profiles ?? []) {
    if (p.full_name) nameById.set(p.id, p.full_name);
  }
  // Athlete names take priority when both exist (see function comment).
  for (const a of athletes ?? []) {
    nameById.set(a.auth_user_id as string, `${a.first_name} ${a.last_name}`);
  }

  return nameById;
}
