import { createClient } from "@/lib/db/server";

/**
 * Best display name for a user_id that may belong to either a staff profile
 * or an athlete account — prefers the athlete's name (first_name/last_name
 * is always populated for a real athlete row; a staff profile's full_name
 * is only ever set if entered manually, and often isn't for a
 * self-registered athlete-turned-staff account). Someone invited by email who
 * has neither gets no entry; callers fall back to their email.
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
