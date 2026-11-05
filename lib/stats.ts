import type { Catalog } from "./catalog";
import type { Muscle } from "./muscles";
import type { HistoryRow, SessionExercise, SetExtra } from "./types";

export type Metric = "e1rm" | "top" | "volume";

export const METRICS: { id: Metric; label: string; long: string }[] = [
  { id: "e1rm", label: "Est. 1RM", long: "Estimated one-rep max" },
  { id: "top", label: "Top set", long: "Heaviest set" },
  { id: "volume", label: "Volume", long: "Volume (weight × reps)" },
];

/** Epley estimate. Sets above 12 reps say little about a max, so they're left out. */
export const e1rm = (kg: number, reps: number) => (kg <= 0 || reps <= 0 || reps > 12 ? 0 : reps === 1 ? kg : kg * (1 + reps / 30));

export type Point = { date: string; sessionId: string; value: number; topKg: number; topReps: number };

/** One point per workout for an exercise, in kg (or kg·reps for volume). Zero-valued workouts are skipped. */
export function seriesFor(history: HistoryRow[], exerciseId: string, metric: Metric, fromDate = ""): Point[] {
  const out: Point[] = [];
  let cur: Point | null = null;
  for (const [sid, date, ex, reps, kg] of history) {
    if (ex !== exerciseId || date < fromDate) continue;
    if (!cur || cur.sessionId !== sid) {
      if (cur && cur.value > 0) out.push(cur);
      cur = { date, sessionId: sid, value: 0, topKg: 0, topReps: 0 };
    }
    if (kg > cur.topKg || (kg === cur.topKg && reps > cur.topReps)) {
      cur.topKg = kg;
      cur.topReps = reps;
    }
    if (metric === "e1rm") cur.value = Math.max(cur.value, e1rm(kg, reps));
    else if (metric === "top") cur.value = Math.max(cur.value, kg);
    else cur.value += kg * reps;
  }
  if (cur && cur.value > 0) out.push(cur);
  return out;
}

/** Sets from the most recent finished workout that included this exercise. */
export function previousSets(history: HistoryRow[], exerciseId: string): { reps: number; weightKg: number; note?: string; x?: SetExtra }[] {
  let lastSid = "";
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i][2] === exerciseId) {
      lastSid = history[i][0];
      break;
    }
  }
  if (!lastSid) return [];
  return history
    .filter((r) => r[0] === lastSid && r[2] === exerciseId)
    .map((r) => ({ reps: r[3], weightKg: r[4], ...(r[5] ? { note: r[5] } : {}), ...(r[6] ? { x: r[6] } : {}) }));
}

/** Best estimated 1RM across all history (kg). */
export function bestE1rm(history: HistoryRow[], exerciseId: string, beforeSession?: string) {
  let best = 0;
  for (const [sid, , ex, reps, kg] of history) {
    if (ex !== exerciseId || sid === beforeSession) continue;
    best = Math.max(best, e1rm(kg, reps));
  }
  return best;
}

/** Most reps in a single set (for bodyweight work) and longest hold (for timed work). */
export function bestReps(history: HistoryRow[], exerciseId: string) {
  let best = 0;
  for (const r of history) if (r[2] === exerciseId) best = Math.max(best, r[3]);
  return best;
}

/** Sets per muscle: a primary muscle counts 1 per set, a secondary one ½. */
export function muscleSets(
  entries: Iterable<{ exerciseId: string; sets: number }>,
  catalog: Catalog
): Partial<Record<Muscle, number>> {
  const out: Partial<Record<Muscle, number>> = {};
  for (const { exerciseId, sets } of entries) {
    const ex = catalog.get(exerciseId);
    if (ex.measure === "cardio") continue; // a treadmill bout isn't a set of squats
    for (const m of ex.primary) out[m] = (out[m] ?? 0) + sets;
    for (const m of ex.secondary) if (!ex.primary.includes(m)) out[m] = (out[m] ?? 0) + sets / 2;
  }
  return out;
}

/** Scale set counts to 0–1 for the body map. */
export function normalise(load: Partial<Record<Muscle, number>>, ceiling?: number) {
  const max = ceiling ?? Math.max(1, ...Object.values(load).map((v) => v ?? 0));
  return Object.fromEntries(Object.entries(load).map(([k, v]) => [k, Math.min(1, (v ?? 0) / max)])) as Partial<Record<Muscle, number>>;
}

export function sessionTotals(exercises: SessionExercise[], onlyDone = true) {
  let sets = 0;
  let volumeKg = 0;
  for (const e of exercises)
    for (const s of e.sets) {
      if (onlyDone && !s.done) continue;
      sets++;
      volumeKg += (s.weightKg ?? 0) * (s.reps ?? 0);
    }
  return { sets, volumeKg };
}
