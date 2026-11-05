import "server-only";
import { isMuscle, type Muscle } from "@/lib/muscles";
import type { Measure } from "@/lib/exercises";
import { SPORT_BY_ID, isSport } from "@/lib/sports";
import type { Activity, RoutineItem, SessionExercise, SetEntry, SetExtra, Unit } from "@/lib/types";

export class BadRequest extends Error {}

const fail = (msg: string): never => {
  throw new BadRequest(msg);
};

export const obj = (v: unknown, what = "body"): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : fail(`${what} must be an object`);

export const str = (v: unknown, what: string, max = 120): string => {
  if (typeof v !== "string") return fail(`${what} must be text`);
  const t = v.trim();
  if (t.length > max) return fail(`${what} is longer than ${max} characters`);
  return t;
};

export const int = (v: unknown, what: string, min: number, max: number): number => {
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) return fail(`${what} must be a whole number from ${min} to ${max}`);
  return v;
};

const EX_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const exerciseId = (v: unknown): string => (typeof v === "string" && EX_ID.test(v) ? v : fail("Unknown exercise id"));

/** 3–32 letters, numbers, dots, dashes or underscores. Case doesn't matter when signing in. */
export const username = (v: unknown): string => {
  const t = typeof v === "string" ? v.trim() : "";
  if (!/^[A-Za-z0-9._-]{3,32}$/.test(t)) return fail("Usernames are 3 to 32 letters, numbers, dots, dashes or underscores.");
  return t;
};

export const password = (v: unknown, what = "Password"): string => {
  if (typeof v !== "string" || v.length < 8) return fail(`${what} needs at least 8 characters.`);
  if (v.length > 200) return fail(`${what} is longer than 200 characters.`);
  return v;
};

export const unit = (v: unknown): Unit => (v === "lb" || v === "kg" ? v : fail("unit must be lb or kg"));

export const measure = (v: unknown): Measure =>
  v === "weight" || v === "bodyweight" || v === "time" ? v : fail("measure must be weight, bodyweight or time");

export const muscles = (v: unknown, what: string, min = 0): Muscle[] => {
  if (!Array.isArray(v)) return fail(`${what} must be a list`);
  const out = [...new Set(v)].filter(isMuscle);
  if (out.length !== v.length || out.length < min) return fail(`${what} has an unknown muscle group`);
  return out;
};

/** Rest between sets: 5 seconds to an hour. null or absent means "use the default". */
export const restSec = (v: unknown): number | null => (v == null ? null : int(v, "Rest time", 5, 3600));

export const routineItems = (v: unknown): RoutineItem[] => {
  if (!Array.isArray(v) || v.length > 40) return fail("A routine holds up to 40 exercises");
  return v.map((raw, i) => {
    const o = obj(raw, `item ${i + 1}`);
    const rest = restSec(o.restSec);
    return {
      exerciseId: exerciseId(o.exerciseId),
      sets: int(o.sets, "Sets", 1, 20),
      reps: int(o.reps, "Reps", 1, 10_800),
      ...(rest != null ? { restSec: rest } : {}),
    };
  });
};

export const num = (v: unknown, what: string, min: number, max: number, decimals = 3): number => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) return fail(`${what} must be a number from ${min} to ${max}`);
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
};

const EXTRA_RANGES: Record<keyof SetExtra, [string, number, number, number]> = {
  sticker: ["Sticker", 0, 5000, 2],
  km: ["Distance", 0, 500, 3],
  m: ["Metres", 0, 100000, 0],
  incline: ["Incline", -10, 40, 1],
  level: ["Level", 0, 100, 1],
  floors: ["Floors", 0, 5000, 0],
  cal: ["Calories", 0, 10000, 0],
  hr: ["Heart rate", 0, 250, 0],
};

const setExtra = (raw: unknown): SetExtra | undefined => {
  if (raw == null) return undefined;
  const o = obj(raw, "set extras");
  const out: SetExtra = {};
  for (const [k, [what, min, max, dec]] of Object.entries(EXTRA_RANGES) as [keyof SetExtra, [string, number, number, number]][])
    if (o[k] != null) out[k] = num(o[k], what, min, max, dec);
  return Object.keys(out).length ? out : undefined;
};

const setEntry = (raw: unknown): SetEntry => {
  const o = obj(raw, "set");
  // Cardio bouts keep their time in seconds here, and routines allow up to 3 hours
  const reps = o.reps == null ? null : int(o.reps, "Reps", 0, 10_800);
  let weightKg: number | null = null;
  if (o.weightKg != null) {
    if (typeof o.weightKg !== "number" || !Number.isFinite(o.weightKg) || o.weightKg < 0 || o.weightKg > 1000) fail("Weight must be between 0 and 1000 kg");
    weightKg = Math.round((o.weightKg as number) * 10000) / 10000;
  }
  const note = o.note == null ? "" : str(o.note, "Set note", 200);
  const x = setExtra(o.x);
  return { reps, weightKg, done: o.done === true, ...(note ? { note } : {}), ...(x ? { x } : {}) };
};

export const sessionExercises = (v: unknown): SessionExercise[] => {
  if (!Array.isArray(v) || v.length > 40) return fail("A workout holds up to 40 exercises");
  const seen = new Set<string>();
  return v.map((raw) => {
    const o = obj(raw, "exercise");
    const id = exerciseId(o.exerciseId);
    if (seen.has(id)) fail("Each exercise can appear once per workout");
    seen.add(id);
    if (!Array.isArray(o.sets) || o.sets.length > 30) fail("An exercise holds up to 30 sets");
    const rest = restSec(o.restSec);
    return { exerciseId: id, sets: (o.sets as unknown[]).map(setEntry), ...(rest != null ? { restSec: rest } : {}) };
  });
};

export const date = (v: unknown, what = "Date"): string => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(`${v}T12:00:00Z`))) return fail(`${what} must be YYYY-MM-DD`);
  return v;
};

/** A moment in the past (or the next minute), as epoch milliseconds. */
export const pastTime = (v: unknown, what = "Time"): number => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < Date.UTC(2000, 0, 1) || v > Date.now() + 60_000) return fail(`${what} must be in the past`);
  return Math.round(v);
};

export const distanceUnit = (v: unknown) => (v === "km" || v === "mi" ? v : fail("distanceUnit must be km or mi"));

/** One sport activity, checked against that sport's fields in lib/sports.ts. */
export function activity(raw: unknown): Omit<Activity, "id" | "date" | "createdAt"> {
  const o = obj(raw);
  if (!isSport(o.sport)) return fail("Unknown sport");
  const def = SPORT_BY_ID[o.sport];
  const startedAt = pastTime(o.startedAt, "Start time");
  const durationSec = o.durationSec == null ? 0 : int(o.durationSec, "Duration", 0, 86_400);
  if (!durationSec && !def.durationOptional) fail("How long did it take?");
  const distanceKm = def.distance && o.distanceKm != null ? num(o.distanceKm, "Distance", 0, 1000) || null : null;
  const inData = o.data == null ? {} : obj(o.data, "data");
  const data: Record<string, string | number> = {};
  for (const f of def.fields) {
    const v = inData[f.key];
    if (v == null || v === "") continue;
    if (f.kind === "int") data[f.key] = int(v, f.label, f.min, f.max);
    else if (f.kind === "effort") data[f.key] = int(v, f.label, 1, 10);
    else if (f.kind === "hr") data[f.key] = int(v, f.label, 30, 250);
    else if (f.kind === "elev") data[f.key] = int(v, f.label, 0, 10_000);
    else if (f.kind === "choice") {
      if (!f.options.some((x) => x.v === v)) fail(`${f.label} isn't one of the choices`);
      data[f.key] = v as string;
    } else if (f.kind === "text") {
      const t = str(v, f.label, 80);
      if (t) data[f.key] = t;
    }
  }
  if (typeof data.won === "number" && typeof data.games === "number" && data.won > data.games) fail("Games won can't be more than games played");
  if (typeof data.fairways === "number" && typeof data.fairwaysOf === "number" && data.fairways > data.fairwaysOf) fail("Fairways hit can't be more than fairway holes");
  const notes = o.notes == null ? "" : str(o.notes, "Notes", 2000);
  return { sport: o.sport, startedAt, durationSec, distanceKm, data, notes };
}

/** A machine preset: its stack reading `sticker` really weighs realKg. */
export function machine(raw: unknown) {
  const b = obj(raw);
  const name = str(b.name, "Name", 60);
  if (!name) fail("Give the machine a name");
  return { name, realKg: num(b.realKg, "Real weight", 0.1, 1000, 4), sticker: num(b.sticker, "Sticker reading", 0.1, 5000, 2) };
}
