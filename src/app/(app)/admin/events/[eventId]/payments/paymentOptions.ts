import type { PaymentStatus } from "@/lib/db/database.types";

export const STATUS_STYLES: Record<PaymentStatus, string> = {
  unpaid: "border-warning/40 bg-warning/10 text-warning-text",
  paid: "border-success/40 bg-success/10 text-success-text",
  waived: "border-border bg-secondary text-secondary-foreground",
  refunded: "border-destructive/40 bg-destructive/10 text-destructive",
};

export const STATUS_OPTIONS = [
  ["unpaid", "Unpaid"],
  ["paid", "Paid"],
  ["waived", "Waived"],
  ["refunded", "Refunded"],
] as const;

export const METHOD_OPTIONS = [
  ["unpaid", "Not set"],
  ["cash", "Cash"],
  ["manual_other", "Other (manual)"],
  ["stripe", "Stripe (future)"],
] as const;

export const METHOD_LABEL = Object.fromEntries(METHOD_OPTIONS) as Record<string, string>;
