/** The requested tab if it exists, else the first. A plain module, so server pages can call it. */
export function pickTab<T extends string>(
  tabs: readonly { value: T }[],
  requested: string | undefined,
): T {
  return tabs.find((t) => t.value === requested)?.value ?? tabs[0].value;
}
