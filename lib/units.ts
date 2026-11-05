import type { Unit } from "./types";

export const KG_PER_LB = 0.45359237;

/** Stored weights are kg; convert for display. */
export const toUnit = (kg: number, unit: Unit) => (unit === "kg" ? kg : kg / KG_PER_LB);

export const fromUnit = (value: number, unit: Unit) => (unit === "kg" ? value : value * KG_PER_LB);

/** Round for display: one decimal at most, trailing .0 dropped. */
export const round1 = (n: number) => Math.round(n * 10) / 10;

export const fmtWeight = (kg: number | null | undefined, unit: Unit) =>
  kg == null ? "" : String(round1(toUnit(kg, unit)));

const big = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
export const fmtBig = (n: number) => big.format(Math.round(n));

/** Parse a user-typed weight in the display unit. Empty → null. */
export function parseWeight(text: string, unit: Unit): number | null | "invalid" {
  const t = text.trim().replace(",", ".");
  if (!t) return null;
  const v = Number(t);
  if (!Number.isFinite(v) || v < 0 || v > (unit === "kg" ? 1000 : 2200)) return "invalid";
  return fromUnit(v, unit);
}

// ---------- distance ----------
export type DistUnit = "km" | "mi";
export const KM_PER_MI = 1.609344;

/** Stored distances are km. */
export const toDist = (km: number, u: DistUnit) => (u === "km" ? km : km / KM_PER_MI);
export const fromDist = (v: number, u: DistUnit) => (u === "km" ? v : v * KM_PER_MI);
/** 5.2 km, 12.75 mi */
export const fmtDist = (km: number | null | undefined, u: DistUnit, withUnit = true) => {
  if (km == null) return "";
  const v = toDist(km, u);
  const s = String(Math.round(v * (v < 10 ? 100 : 10)) / (v < 10 ? 100 : 10));
  return withUnit ? `${s} ${u}` : s;
};
/** Elevation is stored in metres; shown in feet with miles. */
export const fmtElev = (m: number, u: DistUnit) => (u === "km" ? `${Math.round(m)} m` : `${Math.round(m * 3.28084)} ft`);
export const elevUnit = (u: DistUnit) => (u === "km" ? "m" : "ft");
export const toElev = (m: number, u: DistUnit) => (u === "km" ? m : m * 3.28084);
export const fromElev = (v: number, u: DistUnit) => (u === "km" ? v : v / 3.28084);

/** 1:05:09 or 28:30 */
export const fmtClockSec = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
};

/** Pace per km or mile, e.g. 5:29 /km */
export const fmtPace = (sec: number, km: number, u: DistUnit) => {
  const d = toDist(km, u);
  if (!sec || !d) return "";
  return `${fmtClockSec(sec / d)} /${u}`;
};

/** Speed in km/h or mph */
export const fmtSpeed = (sec: number, km: number, u: DistUnit) => {
  if (!sec || !km) return "";
  return `${Math.round((toDist(km, u) / (sec / 3600)) * 10) / 10} ${u === "km" ? "km/h" : "mph"}`;
};

/** Parse "28:30", "1:05:09", "45" (minutes) or "45m" into seconds. Empty → null. */
export function parseDuration(text: string): number | null | "invalid" {
  const t = text.trim();
  if (!t) return null;
  if (/^\d+(\.\d+)?\s*m?$/i.test(t)) return Math.round(parseFloat(t) * 60);
  const parts = t.split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return "invalid";
  const n = parts.map(Number);
  const sec = n.length === 3 ? n[0] * 3600 + n[1] * 60 + n[2] : n[0] * 60 + n[1];
  return sec > 0 && sec < 86400 ? sec : "invalid";
}
