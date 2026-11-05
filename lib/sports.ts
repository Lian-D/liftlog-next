import type { Activity } from "./types";
import { fmtClockSec, fmtDist, fmtElev, fmtPace, fmtSpeed, toDist, toElev, type DistUnit } from "./units";

/**
 * Sports logged on their own, outside a gym workout. Every activity has a sport,
 * a date and start time, and optionally a duration and distance; the rest of each
 * sport's numbers live in `data`, described by `fields` below. The server
 * validates against the same definitions.
 */

export type Sport = "running" | "hiking" | "badminton" | "pickleball" | "golf";

export type SportField =
  | { key: string; label: string; kind: "int"; min: number; max: number; placeholder?: string; unit?: string }
  | { key: string; label: string; kind: "effort" }
  | { key: string; label: string; kind: "hr" }
  | { key: string; label: string; kind: "elev" }
  | { key: string; label: string; kind: "choice"; options: { v: string; label: string }[] }
  | { key: string; label: string; kind: "text"; placeholder?: string };

export type SportDef = {
  id: Sport;
  name: string;
  /** Label for the button that logs one */
  short: string;
  distance: boolean;
  /** Golf is often logged by score alone */
  durationOptional?: boolean;
  fields: SportField[];
  /** Typical length in minutes, to prefill the form */
  typicalMin: number;
};

const effort: SportField = { key: "effort", label: "Effort", kind: "effort" };
const hr: SportField = { key: "hr", label: "Avg heart rate", kind: "hr" };
const elev: SportField = { key: "elev", label: "Elevation gain", kind: "elev" };
const racket = (): SportField[] => [
  { key: "format", label: "Format", kind: "choice", options: [{ v: "singles", label: "Singles" }, { v: "doubles", label: "Doubles" }] },
  { key: "games", label: "Games played", kind: "int", min: 0, max: 99 },
  { key: "won", label: "Games won", kind: "int", min: 0, max: 99 },
  effort,
  hr,
  { key: "place", label: "Where", kind: "text", placeholder: "Club or court" },
];

export const SPORTS: SportDef[] = [
  {
    id: "running", name: "Running", short: "Run", distance: true, typicalMin: 30,
    fields: [
      elev, hr, effort,
      {
        key: "type", label: "Kind of run", kind: "choice",
        options: [
          { v: "easy", label: "Easy" }, { v: "long", label: "Long" }, { v: "tempo", label: "Tempo" },
          { v: "intervals", label: "Intervals" }, { v: "race", label: "Race" }, { v: "trail", label: "Trail" },
        ],
      },
      { key: "place", label: "Route", kind: "text", placeholder: "Seawall loop" },
    ],
  },
  {
    id: "hiking", name: "Hiking", short: "Hike", distance: true, typicalMin: 180,
    fields: [elev, hr, effort, { key: "place", label: "Trail", kind: "text", placeholder: "Grouse Grind" }],
  },
  { id: "badminton", name: "Badminton", short: "Badminton", distance: false, typicalMin: 90, fields: racket() },
  { id: "pickleball", name: "Pickleball", short: "Pickleball", distance: false, typicalMin: 90, fields: racket() },
  {
    id: "golf", name: "Golf", short: "Golf", distance: false, durationOptional: true, typicalMin: 240,
    fields: [
      { key: "holes", label: "Holes", kind: "choice", options: [{ v: "18", label: "18" }, { v: "9", label: "9" }] },
      { key: "score", label: "Score", kind: "int", min: 18, max: 250 },
      { key: "par", label: "Par", kind: "int", min: 27, max: 80 },
      { key: "putts", label: "Putts", kind: "int", min: 0, max: 120 },
      { key: "fairways", label: "Fairways hit", kind: "int", min: 0, max: 18 },
      { key: "fairwaysOf", label: "Fairway holes", kind: "int", min: 0, max: 18, placeholder: "14" },
      { key: "gir", label: "Greens in regulation", kind: "int", min: 0, max: 18 },
      { key: "mode", label: "Got around by", kind: "choice", options: [{ v: "walked", label: "Walking" }, { v: "cart", label: "Cart" }] },
      { key: "place", label: "Course", kind: "text", placeholder: "Course name" },
    ],
  },
];

export const SPORT_BY_ID = Object.fromEntries(SPORTS.map((s) => [s.id, s])) as Record<Sport, SportDef>;
export const isSport = (v: unknown): v is Sport => typeof v === "string" && v in SPORT_BY_ID;

export const EFFORT_LABEL = ["", "Very easy", "Easy", "Easy", "Moderate", "Moderate", "Hard", "Hard", "Very hard", "Very hard", "All out"];

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const pct = (a: number, b: number) => `${Math.round((a / b) * 100)}%`;

export type Stat = { label: string; value: string; hint?: string };

/** The numbers worth showing for one activity, raw ones first, then the worked-out ones. */
export function activityStats(a: Activity, u: DistUnit): Stat[] {
  const d = a.data;
  const out: Stat[] = [];
  if (a.durationSec) out.push({ label: "Time", value: fmtClockSec(a.durationSec) });
  if (a.distanceKm) out.push({ label: "Distance", value: fmtDist(a.distanceKm, u) });
  if (a.distanceKm && a.durationSec) {
    out.push({ label: "Pace", value: fmtPace(a.durationSec, a.distanceKm, u) });
    out.push({ label: "Speed", value: fmtSpeed(a.durationSec, a.distanceKm, u) });
  }
  const e = num(d.elev);
  if (e != null) {
    out.push({ label: "Elevation gain", value: fmtElev(e, u) });
    if (a.sport === "hiking" && a.durationSec) out.push({ label: "Climb rate", value: `${Math.round(toElev(e, u) / (a.durationSec / 3600))} ${u === "km" ? "m" : "ft"}/h` });
  }
  if (a.sport === "badminton" || a.sport === "pickleball") {
    const g = num(d.games);
    const w = num(d.won);
    if (g) out.push({ label: "Games", value: w != null ? `${w} won, ${g - w} lost` : String(g) });
    if (g && w != null) out.push({ label: "Win rate", value: pct(w, g) });
    if (g && a.durationSec) out.push({ label: "Per game", value: fmtClockSec(a.durationSec / g) });
  }
  if (a.sport === "golf") {
    const holes = Number(d.holes) || 18;
    const score = num(d.score);
    const par = num(d.par);
    const putts = num(d.putts);
    const fw = num(d.fairways);
    const fwOf = num(d.fairwaysOf) ?? (holes === 9 ? 7 : 14);
    const gir = num(d.gir);
    if (score != null) out.push({ label: "Score", value: String(score) });
    if (score != null && par != null) {
      const diff = score - par;
      out.push({ label: "To par", value: diff === 0 ? "Even" : diff > 0 ? `+${diff}` : String(diff) });
    }
    if (putts != null) out.push({ label: "Putts per hole", value: (putts / holes).toFixed(1), hint: `${putts} putts` });
    if (fw != null && fwOf) out.push({ label: "Fairways", value: pct(fw, fwOf), hint: `${fw} of ${fwOf}` });
    if (gir != null) out.push({ label: "Greens in reg.", value: pct(gir, holes), hint: `${gir} of ${holes}` });
  }
  const h = num(d.hr);
  if (h) out.push({ label: "Avg heart rate", value: `${h} bpm` });
  const ef = num(d.effort);
  if (ef) out.push({ label: "Effort", value: `${ef}/10`, hint: EFFORT_LABEL[ef] });
  return out;
}

/** One line for lists: "5.2 km · 28:30 · 5:29 /km" */
export function activityLine(a: Activity, u: DistUnit): string {
  const d = a.data;
  const bits: string[] = [];
  if (a.sport === "golf") {
    if (d.holes) bits.push(`${d.holes} holes`);
    const score = num(d.score);
    const par = num(d.par);
    if (score != null) bits.push(par != null ? `${score} (${score - par >= 0 ? "+" : ""}${score - par === 0 ? "E" : score - par})` : String(score));
    if (a.durationSec) bits.push(fmtClockSec(a.durationSec));
    return bits.join(" · ");
  }
  if (a.distanceKm) bits.push(fmtDist(a.distanceKm, u));
  if (a.durationSec) bits.push(a.distanceKm ? fmtClockSec(a.durationSec) : `${Math.round(a.durationSec / 60)} min`);
  if (a.distanceKm && a.durationSec) bits.push(fmtPace(a.durationSec, a.distanceKm, u));
  if ((a.sport === "badminton" || a.sport === "pickleball") && num(d.games)) {
    bits.push(num(d.won) != null ? `won ${d.won} of ${d.games}` : `${d.games} games`);
  }
  if (a.sport === "hiking" && num(d.elev)) bits.push(`↑ ${fmtElev(d.elev as number, u)}`);
  return bits.join(" · ");
}

/** The number Progress charts for each sport, per activity. Lower is better for pace and golf. */
export const TREND: Record<Sport, { label: string; value: (a: Activity, u: DistUnit) => number | null; fmt: (v: number, u: DistUnit) => string; lowerIsBetter?: boolean }> = {
  running: {
    label: "Pace",
    value: (a, u) => (a.distanceKm && a.durationSec ? a.durationSec / toDist(a.distanceKm, u) : null),
    fmt: (v, u) => `${fmtClockSec(v)} /${u}`,
    lowerIsBetter: true,
  },
  hiking: {
    label: "Distance",
    value: (a, u) => (a.distanceKm ? toDist(a.distanceKm, u) : null),
    fmt: (v, u) => `${Math.round(v * 10) / 10} ${u}`,
  },
  badminton: {
    label: "Win rate",
    value: (a) => (num(a.data.games) && num(a.data.won) != null ? ((a.data.won as number) / (a.data.games as number)) * 100 : null),
    fmt: (v) => `${Math.round(v)}%`,
  },
  pickleball: {
    label: "Win rate",
    value: (a) => (num(a.data.games) && num(a.data.won) != null ? ((a.data.won as number) / (a.data.games as number)) * 100 : null),
    fmt: (v) => `${Math.round(v)}%`,
  },
  golf: {
    label: "Score to par",
    value: (a) => (num(a.data.score) != null && num(a.data.par) != null ? (a.data.score as number) - (a.data.par as number) : null),
    fmt: (v) => (v === 0 ? "E" : v > 0 ? `+${v}` : String(v)),
    lowerIsBetter: true,
  },
};

/** Minutes an activity counts for on the heatmap; golf without a time counts as 4 hours (18) or 2 (9). */
export const activityMinutes = (a: Activity) =>
  a.durationSec ? a.durationSec / 60 : a.sport === "golf" ? (a.data.holes === "9" ? 120 : 240) : 0;
