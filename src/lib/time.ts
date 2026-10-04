/** Every date and time RepOne shows is Puerto Rico time, formatted by Intl. */
export const TIME_ZONE = "America/Puerto_Rico";

const day = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const dateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});
const time = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

const toDate = (at: string | Date) => (typeof at === "string" ? new Date(at) : at);

/** A calendar day ("2026-10-04") as written, never shifted by a time zone. */
export function formatDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return day.format(new Date(Date.UTC(y, m - 1, d)));
}

export function formatDayRange(start: string | null, end: string | null, sep = " — "): string {
  if (!start) return "Date TBD";
  if (!end || end === start) return formatDay(start);
  return `${formatDay(start)}${sep}${formatDay(end)}`;
}

/** An instant in Puerto Rico time: "Oct 4, 2026, 10:30 PM". */
export function formatDateTime(at: string | Date): string {
  return dateTime.format(toDate(at)).replace(" at ", ", ");
}

export function formatTime(at: string | Date): string {
  return time.format(toDate(at));
}
