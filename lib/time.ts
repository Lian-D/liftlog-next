/** Everything date-related runs on Pacific time (PDT in summer, PST in winter). */
export const TZ = "America/Los_Angeles";

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** YYYY-MM-DD for the Pacific calendar day of `d`. */
export const pacificDate = (d: Date | number = new Date()) => dayFmt.format(d);

export function tzAbbr(d: Date = new Date()) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "short" }).formatToParts(d);
  return p.find((x) => x.type === "timeZoneName")?.value ?? "PT";
}

/** Noon UTC on a calendar date: a stable point for arithmetic on YYYY-MM-DD strings. */
export const dateToUtcNoon = (date: string) => Date.parse(`${date}T12:00:00Z`);

export const addDays = (date: string, n: number) =>
  new Date(dateToUtcNoon(date) + n * 86_400_000).toISOString().slice(0, 10);

export const daysBetween = (a: string, b: string) => Math.round((dateToUtcNoon(b) - dateToUtcNoon(a)) / 86_400_000);

const longFmt = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" });
const shortFmt = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
const shortYearFmt = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
const weekdayFmt = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" });

export const formatLong = (date: string) => longFmt.format(dateToUtcNoon(date));
export const formatShort = (date: string) => shortFmt.format(dateToUtcNoon(date));
export const formatShortYear = (date: string) => shortYearFmt.format(dateToUtcNoon(date));

/** "Today", "Yesterday", "Tue", or "Oct 12" relative to today's Pacific date. */
export function formatRelative(date: string, today = pacificDate()) {
  const n = daysBetween(date, today);
  if (n === 0) return "Today";
  if (n === 1) return "Yesterday";
  if (n > 1 && n < 7) return weekdayFmt.format(dateToUtcNoon(date));
  return date.slice(0, 4) === today.slice(0, 4) ? formatShort(date) : formatShortYear(date);
}

export function formatDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
});
const offsetAt = (t: number) => {
  const p = Object.fromEntries(partsFmt.formatToParts(t).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - t;
};

/** A Pacific wall-clock date and time ("2026-10-28", "18:30") as a timestamp. Handles PDT/PST. */
export function pacificToEpoch(date: string, time: string) {
  const guess = Date.parse(`${date}T${time}:00Z`);
  const first = guess - offsetAt(guess);
  return guess - offsetAt(first);
}

const hmFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
/** "18:30" in Pacific time */
export const pacificTime = (t: number) => hmFmt.format(t);

const clockFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
/** "6:30 PM" in Pacific time */
export const formatClock = (t: number) => clockFmt.format(t);
