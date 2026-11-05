import type { RoutineItem } from "./types";

const it = (exerciseId: string, sets: number, reps: number): RoutineItem => ({ exerciseId, sets, reps });

/** Starting points offered when there are no routines yet. Everything is editable afterwards. */
export const TEMPLATES: { name: string; blurb: string; items: RoutineItem[] }[] = [
  {
    name: "Push",
    blurb: "Chest, shoulders, triceps",
    items: [
      it("bench-press", 3, 8),
      it("incline-dumbbell-press", 3, 10),
      it("seated-overhead-press", 3, 8),
      it("lateral-raise", 3, 12),
      it("rope-pushdown", 3, 12),
      it("overhead-triceps-extension", 3, 12),
    ],
  },
  {
    name: "Pull",
    blurb: "Back, rear delts, biceps",
    items: [
      it("barbell-row", 3, 8),
      it("lat-pulldown", 3, 10),
      it("seated-cable-row", 3, 10),
      it("reverse-fly", 3, 12),
      it("barbell-curl", 3, 10),
      it("hammer-curl", 3, 10),
    ],
  },
  {
    name: "Legs",
    blurb: "Quads, hamstrings, glutes, calves",
    items: [
      it("back-squat", 3, 5),
      it("romanian-deadlift", 3, 8),
      it("leg-press", 3, 10),
      it("lying-leg-curl", 3, 12),
      it("standing-calf-raise", 3, 12),
      it("cable-crunch", 3, 12),
    ],
  },
  {
    name: "Full body",
    blurb: "One session, every major group",
    items: [
      it("back-squat", 3, 5),
      it("bench-press", 3, 8),
      it("barbell-row", 3, 8),
      it("seated-overhead-press", 3, 8),
      it("romanian-deadlift", 3, 8),
      it("side-plank", 3, 30),
    ],
  },
];
