export type Muscle =
  | "chest"
  | "shoulders"
  | "traps"
  | "back"
  | "lowerBack"
  | "biceps"
  | "triceps"
  | "forearms"
  | "abs"
  | "obliques"
  | "glutes"
  | "quads"
  | "hamstrings"
  | "calves";

export const MUSCLES: { id: Muscle; label: string }[] = [
  { id: "chest", label: "Chest" },
  { id: "shoulders", label: "Shoulders" },
  { id: "traps", label: "Traps" },
  { id: "back", label: "Back" },
  { id: "lowerBack", label: "Lower back" },
  { id: "biceps", label: "Biceps" },
  { id: "triceps", label: "Triceps" },
  { id: "forearms", label: "Forearms" },
  { id: "abs", label: "Abs" },
  { id: "obliques", label: "Obliques" },
  { id: "glutes", label: "Glutes" },
  { id: "quads", label: "Quads" },
  { id: "hamstrings", label: "Hamstrings" },
  { id: "calves", label: "Calves" },
];

export const MUSCLE_LABEL = Object.fromEntries(MUSCLES.map((m) => [m.id, m.label])) as Record<Muscle, string>;

export const isMuscle = (v: unknown): v is Muscle => MUSCLES.some((m) => m.id === v);
