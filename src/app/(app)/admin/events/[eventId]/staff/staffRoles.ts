export type StaffRole = "scorekeeper" | "producer" | "commentator";

export const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  scorekeeper: "Scorekeeper",
  producer: "Producer",
  commentator: "Commentator",
};

/** What each role can do on this event, shown when inviting. */
export const STAFF_ROLE_ACCESS: Record<StaffRole, string> = {
  scorekeeper: "Can enter and save scores, and view heats, lanes and standings for this event.",
  producer:
    "Full production access for this event only: heats, lanes, scores, broadcast control and sponsor triggers.",
  commentator: "Read-only access to the Commentator Dashboard for this event.",
};

export const STAFF_ROLE_OPTIONS = Object.entries(STAFF_ROLE_LABEL) as [StaffRole, string][];

export const COMMENTATOR_LABELS = [
  ["main_commentator", "Main Commentator"],
  ["co_commentator", "Co-Commentator"],
  ["sideline_reporter", "Sideline Reporter"],
  ["interviewer", "Interviewer"],
] as const;
