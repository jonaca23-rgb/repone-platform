"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { getSessionContext } from "@/lib/auth/session";
import type { EntryFormat } from "@/lib/db/database.types";

function readEntryFormat(formData: FormData): EntryFormat {
  const raw = String(formData.get("entry_format") ?? "team");
  return raw === "pair" || raw === "custom" ? raw : "team";
}

/**
 * Teams have existed in the schema since 0001_init.sql (referenced by
 * lanes/results/registrations) but had no UI at all until this module —
 * flagged as a gap in the Requirements Audit. `team_size` here is purely
 * informational for display and fee-matching; it is never a constraint, per
 * the product rule that no fixed roster size (e.g. "teams of 3") is assumed.
 */
export async function createTeam(formData: FormData) {
  const ctx = await getSessionContext();
  if (!ctx?.organizationId) throw new Error("No organization on this account yet.");

  const name = String(formData.get("name") ?? "").trim();
  const affiliate = String(formData.get("affiliate") ?? "") || null;
  const entry_format = readEntryFormat(formData);
  const teamSizeRaw = String(formData.get("team_size") ?? "").trim();
  const team_size = teamSizeRaw ? Number(teamSizeRaw) : null;
  if (!name) throw new Error("Team name is required.");

  const supabase = await createClient();
  const { error } = await supabase.from("teams").insert({
    organization_id: ctx.organizationId,
    name,
    affiliate,
    entry_format,
    team_size: team_size && !Number.isNaN(team_size) ? team_size : null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/teams");
}

export async function deleteTeam(teamId: string) {
  const supabase = await createClient();
  await supabase.from("teams").delete().eq("id", teamId);
  revalidatePath("/admin/teams");
}

export async function addTeamMember(teamId: string, formData: FormData) {
  const athlete_id = String(formData.get("athlete_id") ?? "");
  if (!athlete_id) throw new Error("Choose an athlete to add.");

  const supabase = await createClient();
  const { error } = await supabase.from("team_members").insert({ team_id: teamId, athlete_id });
  if (error) {
    if (error.message.includes("team_members_team_id_athlete_id_key")) {
      throw new Error("That athlete is already on this team's roster.");
    }
    throw new Error(error.message);
  }

  revalidatePath("/admin/teams");
}

export async function removeTeamMember(teamMemberId: string) {
  const supabase = await createClient();
  await supabase.from("team_members").delete().eq("id", teamMemberId);
  revalidatePath("/admin/teams");
}
