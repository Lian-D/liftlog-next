import type { RoutineItem } from "./types";

const it = (exerciseId: string, sets: number, reps: number): RoutineItem => ({ exerciseId, sets, reps });

/** A ready-made routine. Adding one copies it into your routines, where everything is editable. */
export type Template = {
  name: string;
  blurb: string;
  items: RoutineItem[];
  /** Rest between sets, in seconds; leave out to use the account default */
  restSec?: number;
};

/** Premade routines that belong together, such as the two workouts of a 5×5 program. */
export type Program = {
  id: string;
  name: string;
  blurb: string;
  /** How to run it week to week */
  how: string;
  routines: Template[];
};

export const PROGRAMS: Program[] = [
  {
    id: "ppl",
    name: "Push / Pull / Legs",
    blurb: "A classic split by movement: pressing, pulling, then legs.",
    how: "Run them in order, three to six days a week. Add weight once you hit the top of the rep range on every set.",
    routines: [
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
          it("face-pull", 3, 15),
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
    ],
  },
  {
    id: "5x5",
    name: "StrongLifts 5×5",
    blurb: "Three barbell lifts a session, five sets of five, for beginners building strength.",
    how: "Three days a week with a rest day between, alternating A and B. Add 5 lb (2.5 kg) to a lift each session you finish all its reps; deadlifts go up 10 lb (5 kg).",
    routines: [
      {
        name: "StrongLifts A",
        blurb: "Squat, bench press, barbell row",
        restSec: 180,
        items: [it("back-squat", 5, 5), it("bench-press", 5, 5), it("barbell-row", 5, 5)],
      },
      {
        name: "StrongLifts B",
        blurb: "Squat, overhead press, deadlift",
        restSec: 180,
        items: [it("back-squat", 5, 5), it("overhead-press", 5, 5), it("deadlift", 1, 5)],
      },
    ],
  },
  {
    id: "upper-lower",
    name: "Upper / Lower",
    blurb: "Four days a week, each half of the body twice.",
    how: "Upper, Lower, rest, Upper, Lower. Keep a rep or two in reserve on most sets.",
    routines: [
      {
        name: "Upper",
        blurb: "Chest, back, shoulders, arms",
        items: [
          it("bench-press", 3, 6),
          it("barbell-row", 3, 8),
          it("overhead-press", 3, 8),
          it("lat-pulldown", 3, 10),
          it("ez-bar-curl", 2, 12),
          it("triceps-pushdown", 2, 12),
        ],
      },
      {
        name: "Lower",
        blurb: "Quads, hamstrings, glutes, calves, abs",
        items: [
          it("back-squat", 3, 6),
          it("romanian-deadlift", 3, 8),
          it("bulgarian-split-squat", 3, 10),
          it("seated-leg-curl", 3, 12),
          it("standing-calf-raise", 3, 12),
          it("plank", 3, 45),
        ],
      },
    ],
  },
  {
    id: "full-body",
    name: "Full body",
    blurb: "One session that trains every major group.",
    how: "Two or three times a week, with a day off between.",
    routines: [
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
    ],
  },
];
