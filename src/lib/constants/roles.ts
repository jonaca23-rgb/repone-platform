import type { UserRoleDb } from "@/lib/db/database.types";

export const ROLE_LABELS: Record<UserRoleDb, string> = {
  admin: "Admin",
  event_director: "Event Director",
  scoring_operator: "Scoring Operator",
  production_director: "Production Director",
  commentator: "Commentator",
};
