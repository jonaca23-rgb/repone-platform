import type { ExpenseCategory } from "@/lib/db/database.types";

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  venue: "Venue",
  equipment: "Equipment",
  staff_judges: "Judges / Staff",
  prizes: "Prizes",
  marketing: "Marketing",
  other: "Other",
};

export const CATEGORY_ORDER: ExpenseCategory[] = [
  "venue",
  "equipment",
  "staff_judges",
  "prizes",
  "marketing",
  "other",
];
