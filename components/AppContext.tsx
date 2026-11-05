"use client";

import { createContext, useContext, type Dispatch, type SetStateAction } from "react";
import type { Catalog } from "@/lib/catalog";
import type { Sport } from "@/lib/sports";
import type { Bootstrap, Unit } from "@/lib/types";

export type Tab = "train" | "routines" | "exercises" | "history" | "progress";
export const TABS: Tab[] = ["train", "routines", "exercises", "history", "progress"];

export type AppCtx = {
  data: Bootstrap;
  setData: Dispatch<SetStateAction<Bootstrap | null>>;
  reload: () => Promise<void>;
  unit: Unit;
  catalog: Catalog;
  today: string;
  go: (tab: Tab) => void;
  openGuide: (exerciseId: string) => void;
  /** Show a finished workout in full */
  openWorkout: (sessionId: string) => void;
  /** Show a sport activity, or with a sport (and optional day) log a new one */
  openActivity: (target: { id: string } | { sport: Sport; date?: string }) => void;
  /** Everything on one day, with ways to log more for it */
  openDay: (date: string) => void;
  /** Log or edit bodyweight, for today unless a day is given */
  openBodyWeight: (date?: string) => void;
  /** Log a workout that already happened */
  openPastWorkout: (date?: string) => void;
  /** Open a routine in the routine editor */
  editRoutine: (id: string | null) => void;
  editingRoutineId: string | null;
  notify: (message: string) => void;
  /** Runs an action and reports its error message instead of throwing */
  attempt: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
};

export const Ctx = createContext<AppCtx | null>(null);

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp outside <App>");
  return c;
}
