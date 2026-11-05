import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import { signupOpen } from "./auth";
import { EXERCISE_BY_ID } from "@/lib/exercises";
import { pacificDate } from "@/lib/time";
import type {
  Activity,
  BodyWeight,
  Bootstrap,
  CustomExercise,
  ExercisePref,
  HistoryRow,
  Machine,
  SetExtra,
  Me,
  Routine,
  RoutineItem,
  Session,
  SessionExercise,
  SessionSummary,
  Settings,
} from "@/lib/types";

/*
 * Every function takes the signed-in user's id first and only ever touches that
 * user's rows. Looking up someone else's routine or workout behaves as "not found".
 */

const now = () => Date.now();

// ---------------- Settings (per user) ----------------

const DEFAULT_SETTINGS: Settings = { unit: "lb", restSec: 90, restAuto: true, timerSound: true, keepAwake: true, distanceUnit: "km" };

export function getSettings(uid: string): Settings {
  const rows = db().prepare("SELECT key, value FROM user_settings WHERE user_id = ?").all(uid) as { key: string; value: string }[];
  const out = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    if (r.key === "unit" && (r.value === "lb" || r.value === "kg")) out.unit = r.value;
    if (r.key === "restSec") out.restSec = Number(r.value) || DEFAULT_SETTINGS.restSec;
    if (r.key === "restAuto" || r.key === "timerSound" || r.key === "keepAwake") out[r.key] = r.value === "true";
    if (r.key === "distanceUnit" && (r.value === "km" || r.value === "mi")) out.distanceUnit = r.value;
  }
  return out;
}

export function saveSettings(uid: string, patch: Partial<Settings>): Settings {
  const stmt = db().prepare(
    "INSERT INTO user_settings (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value"
  );
  db().transaction(() => {
    for (const [k, v] of Object.entries(patch)) if (v != null) stmt.run(uid, k, String(v));
  })();
  return getSettings(uid);
}

// ---------------- Routines ----------------

type RoutineRow = { id: string; name: string; items: string; rest_sec: number | null; position: number; created_at: number; updated_at: number };

const toRoutine = (r: RoutineRow): Routine => ({
  id: r.id,
  name: r.name,
  items: JSON.parse(r.items),
  restSec: r.rest_sec,
  position: r.position,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export function listRoutines(uid: string): Routine[] {
  return (db().prepare("SELECT * FROM routines WHERE user_id = ? ORDER BY position, created_at").all(uid) as RoutineRow[]).map(toRoutine);
}

export function getRoutine(uid: string, id: string): Routine | null {
  const r = db().prepare("SELECT * FROM routines WHERE id = ? AND user_id = ?").get(id, uid) as RoutineRow | undefined;
  return r ? toRoutine(r) : null;
}

export function createRoutine(uid: string, name: string, items: RoutineItem[], restSec: number | null = null): Routine {
  const id = randomUUID();
  const t = now();
  const pos = (db().prepare("SELECT COALESCE(MAX(position), -1) + 1 AS p FROM routines WHERE user_id = ?").get(uid) as { p: number }).p;
  db().prepare("INSERT INTO routines (id, user_id, name, items, rest_sec, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(id, uid, name, JSON.stringify(items), restSec, pos, t, t);
  return getRoutine(uid, id)!;
}

/** restSec: undefined leaves it alone, null goes back to the account default. */
export function updateRoutine(uid: string, id: string, patch: { name?: string; items?: RoutineItem[]; restSec?: number | null }): Routine | null {
  const cur = getRoutine(uid, id);
  if (!cur) return null;
  db().prepare("UPDATE routines SET name = ?, items = ?, rest_sec = ?, updated_at = ? WHERE id = ? AND user_id = ?")
    .run(patch.name ?? cur.name, JSON.stringify(patch.items ?? cur.items), patch.restSec === undefined ? cur.restSec : patch.restSec, now(), id, uid);
  return getRoutine(uid, id);
}

export function deleteRoutine(uid: string, id: string) {
  return db().prepare("DELETE FROM routines WHERE id = ? AND user_id = ?").run(id, uid).changes > 0;
}

// ---------------- Custom exercises ----------------

type CustomRow = { id: string; name: string; equipment: string; primary_muscles: string; secondary_muscles: string; measure: string; created_at: number };

export function listCustomExercises(uid: string): CustomExercise[] {
  return (db().prepare("SELECT * FROM custom_exercises WHERE user_id = ? ORDER BY name").all(uid) as CustomRow[]).map((r) => ({
    id: r.id,
    name: r.name,
    equipment: r.equipment,
    primary: JSON.parse(r.primary_muscles),
    secondary: JSON.parse(r.secondary_muscles),
    measure: r.measure as CustomExercise["measure"],
    createdAt: r.created_at,
  }));
}

export function createCustomExercise(uid: string, e: Omit<CustomExercise, "id" | "createdAt">): CustomExercise {
  const id = "custom-" + randomUUID().slice(0, 8);
  db().prepare("INSERT INTO custom_exercises (id, user_id, name, equipment, primary_muscles, secondary_muscles, measure, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(id, uid, e.name, e.equipment, JSON.stringify(e.primary), JSON.stringify(e.secondary), e.measure, now());
  return listCustomExercises(uid).find((x) => x.id === id)!;
}

export function deleteCustomExercise(uid: string, id: string) {
  return db().prepare("DELETE FROM custom_exercises WHERE id = ? AND user_id = ?").run(id, uid).changes > 0;
}

/** A built-in exercise, or one of this user's own. */
export function exerciseExists(uid: string, id: string) {
  return id in EXERCISE_BY_ID || !!db().prepare("SELECT 1 FROM custom_exercises WHERE id = ? AND user_id = ?").get(id, uid);
}

// ---------------- Sessions (workouts) ----------------

type SessionRow = {
  id: string;
  routine_id: string | null;
  name: string;
  date: string;
  started_at: number;
  finished_at: number | null;
  notes: string;
  exercise_order: string;
  rest_sec: number | null;
  exercise_rest: string;
  past_min: number | null;
};
type SetRow = { exercise_id: string; set_index: number; reps: number | null; weight_kg: number | null; done: number; note: string | null; extra: string | null };

const parseExtra = (v: string | null): SetExtra | undefined => {
  if (!v) return undefined;
  try {
    const x = JSON.parse(v);
    return x && typeof x === "object" && Object.keys(x).length ? x : undefined;
  } catch {
    return undefined;
  }
};

function loadSession(r: SessionRow): Session {
  const order: string[] = JSON.parse(r.exercise_order);
  const rest: Record<string, number> = JSON.parse(r.exercise_rest || "{}");
  const sets = db().prepare("SELECT exercise_id, set_index, reps, weight_kg, done, note, extra FROM sets WHERE session_id = ? ORDER BY set_index").all(r.id) as SetRow[];
  const blank = (id: string): SessionExercise => ({ exerciseId: id, sets: [], ...(rest[id] ? { restSec: rest[id] } : {}) });
  const byEx = new Map<string, SessionExercise>(order.map((id) => [id, blank(id)]));
  for (const s of sets) {
    let ex = byEx.get(s.exercise_id);
    if (!ex) byEx.set(s.exercise_id, (ex = blank(s.exercise_id)));
    const x = parseExtra(s.extra);
    ex.sets.push({ reps: s.reps, weightKg: s.weight_kg, done: !!s.done, ...(s.note ? { note: s.note } : {}), ...(x ? { x } : {}) });
  }
  return {
    id: r.id,
    routineId: r.routine_id,
    name: r.name,
    date: r.date,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    notes: r.notes,
    restSec: r.rest_sec,
    pastMin: r.past_min,
    exercises: [...byEx.values()],
  };
}

export function getSession(uid: string, id: string): Session | null {
  const r = db().prepare("SELECT * FROM sessions WHERE id = ? AND user_id = ?").get(id, uid) as SessionRow | undefined;
  return r ? loadSession(r) : null;
}

export function getActiveSession(uid: string): Session | null {
  const r = db().prepare("SELECT * FROM sessions WHERE user_id = ? AND finished_at IS NULL ORDER BY started_at DESC LIMIT 1").get(uid) as SessionRow | undefined;
  return r ? loadSession(r) : null;
}

/** Callers must have checked the session belongs to the user. */
function writeSets(sessionId: string, exercises: SessionExercise[]) {
  const ins = db().prepare("INSERT INTO sets (session_id, exercise_id, set_index, reps, weight_kg, done, note, extra) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  db().prepare("DELETE FROM sets WHERE session_id = ?").run(sessionId);
  for (const ex of exercises)
    ex.sets.forEach((s, i) =>
      ins.run(sessionId, ex.exerciseId, i, s.reps, s.weightKg, s.done ? 1 : 0, s.note?.trim() || null, s.x && Object.keys(s.x).length ? JSON.stringify(s.x) : null)
    );
  const rest = Object.fromEntries(exercises.filter((e) => e.restSec).map((e) => [e.exerciseId, e.restSec]));
  db().prepare("UPDATE sessions SET exercise_order = ?, exercise_rest = ? WHERE id = ?")
    .run(JSON.stringify(exercises.map((e) => e.exerciseId)), JSON.stringify(rest), sessionId);
}

/**
 * Start a workout. From a routine, each exercise gets its target number of sets with
 * the reps filled in. With `past`, it's a workout logged afterwards: it starts at
 * past.at and finishes past.min minutes later, whenever it's saved.
 */
export function startSession(uid: string, routine: Routine | null, name?: string, past?: { at: number; min: number }): Session {
  const active = getActiveSession(uid);
  if (active) return active;
  const id = randomUUID();
  const t = past?.at ?? now();
  const exercises: SessionExercise[] = (routine?.items ?? []).map((it) => ({
    exerciseId: it.exerciseId,
    sets: Array.from({ length: it.sets }, () => ({ reps: it.reps, weightKg: null, done: false })),
    ...(it.restSec ? { restSec: it.restSec } : {}),
  }));
  db().transaction(() => {
    db().prepare("INSERT INTO sessions (id, user_id, routine_id, name, date, started_at, rest_sec, past_min) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, uid, routine?.id ?? null, routine?.name ?? name ?? "Workout", pacificDate(t), t, routine?.restSec ?? null, past?.min ?? null);
    writeSets(id, exercises);
  })();
  return getSession(uid, id)!;
}

/**
 * Start a workout that repeats a past one: same exercises, same number of sets and
 * reps. Weights are left empty so the logger suggests what was lifted last time.
 */
export function repeatSession(uid: string, past: Session, when?: { at: number; min: number }): Session {
  const active = getActiveSession(uid);
  if (active) return active;
  const id = randomUUID();
  const t = when?.at ?? now();
  const exercises: SessionExercise[] = past.exercises.map((e) => ({
    exerciseId: e.exerciseId,
    sets: e.sets.map((s) => ({ reps: s.reps, weightKg: null, done: false })),
    ...(e.restSec ? { restSec: e.restSec } : {}),
  }));
  db().transaction(() => {
    db().prepare("INSERT INTO sessions (id, user_id, routine_id, name, date, started_at, rest_sec, past_min) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, uid, past.routineId, past.name, pacificDate(t), t, past.restSec, when?.min ?? null);
    writeSets(id, exercises);
  })();
  return getSession(uid, id)!;
}

export function saveSession(
  uid: string,
  id: string,
  patch: { name?: string; notes?: string; restSec?: number | null; pastMin?: number; startedAt?: number; exercises?: SessionExercise[] }
): Session | null {
  const cur = getSession(uid, id);
  if (!cur) return null;
  // Only a workout logged afterwards can have its start and length changed
  const past = cur.pastMin != null;
  const startedAt = past && patch.startedAt != null ? patch.startedAt : cur.startedAt;
  db().transaction(() => {
    db().prepare("UPDATE sessions SET name = ?, notes = ?, rest_sec = ?, past_min = ?, started_at = ?, date = ? WHERE id = ?")
      .run(
        patch.name ?? cur.name,
        patch.notes ?? cur.notes,
        patch.restSec === undefined ? cur.restSec : patch.restSec,
        past ? patch.pastMin ?? cur.pastMin : null,
        startedAt,
        pacificDate(startedAt),
        id
      );
    if (patch.exercises) writeSets(id, patch.exercises);
  })();
  return getSession(uid, id);
}

/**
 * Finish a workout: keep only the sets that were checked off. A workout with
 * nothing checked is discarded rather than saved empty.
 */
export function finishSession(uid: string, id: string): { session: Session | null; discarded: boolean } {
  const cur = getSession(uid, id);
  if (!cur) return { session: null, discarded: false };
  const kept = cur.exercises
    .map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) }))
    .filter((e) => e.sets.length > 0);
  if (!kept.length) {
    deleteSession(uid, id);
    return { session: null, discarded: true };
  }
  const t = now();
  db().transaction(() => {
    writeSets(id, kept);
    // The workout keeps the Pacific day it started on. One logged afterwards ends when its length says.
    const end = cur.pastMin != null ? cur.startedAt + cur.pastMin * 60_000 : Math.max(t, cur.startedAt);
    db().prepare("UPDATE sessions SET finished_at = ? WHERE id = ?").run(end, id);
  })();
  return { session: getSession(uid, id), discarded: false };
}

export function deleteSession(uid: string, id: string) {
  return db().prepare("DELETE FROM sessions WHERE id = ? AND user_id = ?").run(id, uid).changes > 0;
}

export function listSessionSummaries(uid: string): SessionSummary[] {
  return db()
    .prepare(
      "SELECT id, routine_id AS routineId, name, date, started_at AS startedAt, finished_at AS finishedAt FROM sessions WHERE user_id = ? AND finished_at IS NOT NULL ORDER BY started_at DESC"
    )
    .all(uid) as SessionSummary[];
}

/** Every completed set from this user's finished workouts, oldest first, in a compact tuple form. */
export function history(uid: string): HistoryRow[] {
  const rows = db()
    .prepare(
      `SELECT s.id AS sid, s.date AS date, x.exercise_id AS ex, x.reps AS reps, x.weight_kg AS w, x.note AS note, x.extra AS extra
       FROM sets x JOIN sessions s ON s.id = x.session_id
       WHERE s.user_id = ? AND s.finished_at IS NOT NULL AND x.done = 1
       ORDER BY s.started_at, x.id`
    )
    .all(uid) as { sid: string; date: string; ex: string; reps: number | null; w: number | null; note: string | null; extra: string | null }[];
  // Note and extras ride along only when there are any, to keep the payload small
  return rows.map((r): HistoryRow => {
    const row: HistoryRow = [r.sid, r.date, r.ex, r.reps ?? 0, r.w ?? 0];
    const x = parseExtra(r.extra);
    if (r.note || x) row.push(r.note || null);
    if (x) row.push(x);
    return row;
  });
}

// ---------------- Setup notes and machines ----------------

export function listExercisePrefs(uid: string): Record<string, ExercisePref> {
  const rows = db().prepare("SELECT exercise_id, note, machine_id FROM exercise_prefs WHERE user_id = ?").all(uid) as { exercise_id: string; note: string; machine_id: string | null }[];
  return Object.fromEntries(rows.map((r) => [r.exercise_id, { note: r.note, machineId: r.machine_id }]));
}

export function saveExercisePref(uid: string, exerciseId: string, patch: Partial<ExercisePref>): ExercisePref {
  const cur = listExercisePrefs(uid)[exerciseId] ?? { note: "", machineId: null };
  const next = { note: patch.note ?? cur.note, machineId: patch.machineId === undefined ? cur.machineId : patch.machineId };
  if (!next.note && !next.machineId) db().prepare("DELETE FROM exercise_prefs WHERE user_id = ? AND exercise_id = ?").run(uid, exerciseId);
  else
    db()
      .prepare(
        `INSERT INTO exercise_prefs (user_id, exercise_id, note, machine_id, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(user_id, exercise_id) DO UPDATE SET note = excluded.note, machine_id = excluded.machine_id, updated_at = excluded.updated_at`
      )
      .run(uid, exerciseId, next.note, next.machineId, now());
  return next;
}

type MachineRow = { id: string; name: string; real_kg: number; sticker: number; created_at: number };
const toMachine = (r: MachineRow): Machine => ({ id: r.id, name: r.name, realKg: r.real_kg, sticker: r.sticker, createdAt: r.created_at });

export function listMachines(uid: string): Machine[] {
  return (db().prepare("SELECT * FROM machines WHERE user_id = ? ORDER BY name COLLATE NOCASE").all(uid) as MachineRow[]).map(toMachine);
}

export function getMachine(uid: string, id: string): Machine | null {
  const r = db().prepare("SELECT * FROM machines WHERE id = ? AND user_id = ?").get(id, uid) as MachineRow | undefined;
  return r ? toMachine(r) : null;
}

export function saveMachine(uid: string, id: string | null, m: { name: string; realKg: number; sticker: number }): Machine | null {
  if (id) {
    const ok = db().prepare("UPDATE machines SET name = ?, real_kg = ?, sticker = ? WHERE id = ? AND user_id = ?").run(m.name, m.realKg, m.sticker, id, uid).changes;
    return ok ? getMachine(uid, id) : null;
  }
  const newId = randomUUID();
  db().prepare("INSERT INTO machines (id, user_id, name, real_kg, sticker, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(newId, uid, m.name, m.realKg, m.sticker, now());
  return getMachine(uid, newId);
}

export function deleteMachine(uid: string, id: string) {
  return db().transaction(() => {
    const gone = db().prepare("DELETE FROM machines WHERE id = ? AND user_id = ?").run(id, uid).changes > 0;
    if (gone) {
      db().prepare("UPDATE exercise_prefs SET machine_id = NULL WHERE user_id = ? AND machine_id = ?").run(uid, id);
      db().prepare("DELETE FROM exercise_prefs WHERE user_id = ? AND note = '' AND machine_id IS NULL").run(uid);
    }
    return gone;
  })();
}

// ---------------- Bodyweight ----------------

export function listBodyWeights(uid: string): BodyWeight[] {
  return db().prepare("SELECT date, kg, note FROM body_weights WHERE user_id = ? ORDER BY date").all(uid) as BodyWeight[];
}

/** Set one day's bodyweight and note. Clearing both removes the day. */
export function saveBodyWeight(uid: string, date: string, kg: number | null, note: string) {
  if (kg == null && !note) db().prepare("DELETE FROM body_weights WHERE user_id = ? AND date = ?").run(uid, date);
  else
    db()
      .prepare(
        `INSERT INTO body_weights (user_id, date, kg, note, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(user_id, date) DO UPDATE SET kg = excluded.kg, note = excluded.note, updated_at = excluded.updated_at`
      )
      .run(uid, date, kg, note, now());
  return listBodyWeights(uid);
}

// ---------------- Sports ----------------

type ActivityRow = { id: string; sport: string; date: string; started_at: number; duration_sec: number; distance_km: number | null; data: string; notes: string; created_at: number };
const toActivity = (r: ActivityRow): Activity => ({
  id: r.id,
  sport: r.sport as Activity["sport"],
  date: r.date,
  startedAt: r.started_at,
  durationSec: r.duration_sec,
  distanceKm: r.distance_km,
  data: JSON.parse(r.data || "{}"),
  notes: r.notes,
  createdAt: r.created_at,
});

export function listActivities(uid: string): Activity[] {
  return (db().prepare("SELECT * FROM activities WHERE user_id = ? ORDER BY started_at").all(uid) as ActivityRow[]).map(toActivity);
}

export function getActivity(uid: string, id: string): Activity | null {
  const r = db().prepare("SELECT * FROM activities WHERE id = ? AND user_id = ?").get(id, uid) as ActivityRow | undefined;
  return r ? toActivity(r) : null;
}

export type ActivityInput = Omit<Activity, "id" | "date" | "createdAt">;

export function saveActivity(uid: string, id: string | null, a: ActivityInput): Activity | null {
  const args = [a.sport, pacificDate(a.startedAt), a.startedAt, a.durationSec, a.distanceKm, JSON.stringify(a.data), a.notes];
  if (id) {
    const ok = db()
      .prepare("UPDATE activities SET sport = ?, date = ?, started_at = ?, duration_sec = ?, distance_km = ?, data = ?, notes = ? WHERE id = ? AND user_id = ?")
      .run(...args, id, uid).changes;
    return ok ? getActivity(uid, id) : null;
  }
  const newId = randomUUID();
  db()
    .prepare("INSERT INTO activities (sport, date, started_at, duration_sec, distance_km, data, notes, id, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(...args, newId, uid, now());
  return getActivity(uid, newId);
}

export function deleteActivity(uid: string, id: string) {
  return db().prepare("DELETE FROM activities WHERE id = ? AND user_id = ?").run(id, uid).changes > 0;
}

export function bootstrap(me: Me): Bootstrap {
  return {
    me,
    ...(me.isAdmin ? { signupOpen: signupOpen() } : {}),
    settings: getSettings(me.id),
    routines: listRoutines(me.id),
    customExercises: listCustomExercises(me.id),
    activeSession: getActiveSession(me.id),
    sessions: listSessionSummaries(me.id),
    history: history(me.id),
    exercisePrefs: listExercisePrefs(me.id),
    machines: listMachines(me.id),
    bodyWeights: listBodyWeights(me.id),
    activities: listActivities(me.id),
  };
}

/** Full dump of one user's data for backups: everything, including the workout in progress. */
export function exportAll(me: Me) {
  const sessions = (db().prepare("SELECT * FROM sessions WHERE user_id = ? ORDER BY started_at").all(me.id) as SessionRow[]).map(loadSession);
  return {
    app: "liftlog",
    version: 1,
    exportedAt: new Date().toISOString(),
    account: me.username,
    weightsAreIn: "kg",
    settings: getSettings(me.id),
    routines: listRoutines(me.id),
    customExercises: listCustomExercises(me.id),
    exercisePrefs: listExercisePrefs(me.id),
    machines: listMachines(me.id),
    bodyWeights: listBodyWeights(me.id),
    activities: listActivities(me.id),
    sessions,
  };
}
