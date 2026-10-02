import type { OrgRole } from "@/lib/auth/permissions";

export const ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Owner",
  admin: "Admin",
  event_director: "Event Director",
  scoring_operator: "Scoring Operator",
  production_director: "Production Director",
  commentator: "Commentator",
};
