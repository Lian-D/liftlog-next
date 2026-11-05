import { EXERCISES, EXERCISE_BY_ID, type Exercise } from "./exercises";
import type { CustomExercise } from "./types";

export type Catalog = { all: Exercise[]; get: (id: string) => Exercise };

const fromCustom = (c: CustomExercise): Exercise => ({
  id: c.id,
  name: c.name,
  equipment: c.equipment || "Other",
  primary: c.primary,
  secondary: c.secondary,
  measure: c.measure,
  sets: 3,
  reps: c.measure === "time" ? 30 : 10,
  steps: [],
  cues: [],
  image: false,
  custom: true,
});

/** Built-in exercises plus the user's own, with a safe fallback for ids that no longer exist. */
export function buildCatalog(custom: CustomExercise[]): Catalog {
  const mine = custom.map(fromCustom);
  const byId: Record<string, Exercise> = { ...EXERCISE_BY_ID, ...Object.fromEntries(mine.map((e) => [e.id, e])) };
  const all = [...EXERCISES, ...mine].sort((a, b) => a.name.localeCompare(b.name));
  return {
    all,
    get: (id) =>
      byId[id] ?? {
        id, name: "Removed exercise", equipment: "", primary: [], secondary: [], measure: "weight",
        sets: 3, reps: 10, steps: [], cues: [], image: false, custom: true,
      },
  };
}
