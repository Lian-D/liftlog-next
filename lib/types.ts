import type { Measure } from "./exercises";
import type { Muscle } from "./muscles";
import type { Sport } from "./sports";

export type Unit = "lb" | "kg";
export type DistUnit = "km" | "mi";

export type Settings = {
  unit: Unit;
  /** Default rest after a set, in seconds */
  restSec: number;
  /** Start the rest timer when a set is ticked */
  restAuto: boolean;
  /** Beep when a timer ends */
  timerSound: boolean;
  /** Keep the screen on while a timer runs */
  keepAwake: boolean;
  /** For runs, hikes and cardio machines */
  distanceUnit: DistUnit;
};

/** restSec, when set, overrides the routine's rest for this exercise */
export type RoutineItem = { exerciseId: string; sets: number; reps: number; restSec?: number };

export type Routine = {
  id: string;
  name: string;
  items: RoutineItem[];
  /** Rest between sets for this routine; null uses the account default */
  restSec: number | null;
  position: number;
  createdAt: number;
  updatedAt: number;
};

/**
 * Extra numbers on a set. sticker: the number on a machine's weight stack (weightKg
 * then holds the real weight worked out from it). The rest are for cardio machines,
 * where reps holds the time in seconds: km, m (rowing), incline %, level, floors,
 * cal and hr (average heart rate).
 */
export type SetExtra = { sticker?: number; km?: number; m?: number; incline?: number; level?: number; floors?: number; cal?: number; hr?: number };

export type SetEntry = { reps: number | null; weightKg: number | null; done: boolean; note?: string; x?: SetExtra };

/** restSec, when set, overrides the workout's rest for this exercise */
export type SessionExercise = { exerciseId: string; sets: SetEntry[]; restSec?: number };

export type Session = {
  id: string;
  routineId: string | null;
  name: string;
  /** YYYY-MM-DD in Pacific time */
  date: string;
  startedAt: number;
  finishedAt: number | null;
  notes: string;
  /** Rest between sets for this workout; null uses the account default */
  restSec: number | null;
  /** Set for a workout logged afterwards: how long it took, in minutes. It ends that long after it started. */
  pastMin: number | null;
  exercises: SessionExercise[];
};

export type SessionSummary = {
  id: string;
  routineId: string | null;
  name: string;
  date: string;
  startedAt: number;
  finishedAt: number;
};

/** One completed set from a finished session: [sessionId, date, exerciseId, reps, weightKg, note?, extra?] */
export type HistoryRow = [string, string, string, number, number, (string | null)?, SetExtra?];

/** Your own note on an exercise (rack height, seat setting) and the machine whose stickers it uses. */
export type ExercisePref = { note: string; machineId: string | null };

/** A weight-stack machine whose numbers aren't real pounds or kilos: realKg is what the stack reading `sticker` actually weighs. */
export type Machine = { id: string; name: string; realKg: number; sticker: number; createdAt: number };

export type BodyWeight = { date: string; kg: number | null; note: string };

export type Activity = {
  id: string;
  sport: Sport;
  /** YYYY-MM-DD in Pacific time */
  date: string;
  startedAt: number;
  durationSec: number;
  distanceKm: number | null;
  data: Record<string, string | number>;
  notes: string;
  createdAt: number;
};

export type CustomExercise = {
  id: string;
  name: string;
  equipment: string;
  primary: Muscle[];
  secondary: Muscle[];
  measure: Measure;
  createdAt: number;
};

export type Me = { id: string; username: string; isAdmin: boolean };

export type UserSummary = {
  id: string;
  username: string;
  isAdmin: boolean;
  createdAt: number;
  lastLoginAt: number | null;
  workouts: number;
};

export type Bootstrap = {
  me: Me;
  /** Only sent to admins */
  signupOpen?: boolean;
  settings: Settings;
  routines: Routine[];
  customExercises: CustomExercise[];
  activeSession: Session | null;
  sessions: SessionSummary[];
  history: HistoryRow[];
  exercisePrefs: Record<string, ExercisePref>;
  machines: Machine[];
  bodyWeights: BodyWeight[];
  activities: Activity[];
};
