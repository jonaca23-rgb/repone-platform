const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** Cents as dollars: 7500 → "$75.00", 123456789 → "$1,234,567.89". */
export function formatCents(cents: number): string {
  return usd.format(cents / 100);
}
