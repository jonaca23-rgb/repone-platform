import { ORG_ROLES, type OrgRole } from "@/lib/auth/permissions";

export const ROLE_LABEL: Record<OrgRole, string> = {
  owner: "Owner",
  admin: "Admin",
  event_director: "Event director",
  production_director: "Production director",
  scoring_operator: "Scoring operator",
  commentator: "Commentator",
};

/** Owner is never granted by invitation; ownership is not transferable in the app yet (lib/actions/team.ts). */
export const INVITABLE_ROLES = ORG_ROLES.filter((r) => r !== "owner");

export const ROLE_OPTIONS = ORG_ROLES.map((r) => [r, ROLE_LABEL[r]] as const);
