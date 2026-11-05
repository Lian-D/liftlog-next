import type {
  Activity, BodyWeight, Bootstrap, CustomExercise, ExercisePref, Machine, Me, Routine, RoutineItem, Session, SessionExercise, Settings, UserSummary,
} from "./types";

/** A workout logged afterwards: when it started, and how many minutes it took */
export type PastStart = { at: number; pastMin: number };
export type ActivityBody = Omit<Activity, "id" | "date" | "createdAt">;

async function call<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    credentials: "same-origin",
  });
  const j = await r.json().catch(() => ({}));
  // Session ended (signed out elsewhere, password reset, expired): the page will show the sign-in screen
  if (r.status === 401 && !url.startsWith("/api/auth/")) window.location.reload();
  if (!r.ok) throw new Error((j as { error?: string }).error || `The server answered ${r.status}.`);
  return j as T;
}

export const api = {
  bootstrap: () => call<Bootstrap>("/api/bootstrap"),
  saveSettings: (patch: Partial<Settings>) => call<Settings>("/api/settings", "PUT", patch),

  createRoutine: (name: string, items: RoutineItem[] = [], restSec: number | null = null) =>
    call<Routine>("/api/routines", "POST", { name, items, restSec }),
  updateRoutine: (id: string, patch: { name?: string; items?: RoutineItem[]; restSec?: number | null }) =>
    call<Routine>(`/api/routines/${id}`, "PUT", patch),
  deleteRoutine: (id: string) => call<{ ok: true }>(`/api/routines/${id}`, "DELETE"),

  startSession: (routineId: string | null, name?: string, past?: PastStart) => call<Session>("/api/sessions", "POST", { routineId, name, ...past }),
  getSession: (id: string) => call<Session>(`/api/sessions/${id}`),
  repeatSession: (fromSessionId: string, past?: PastStart) => call<Session>("/api/sessions", "POST", { fromSessionId, ...past }),
  saveSession: (
    id: string,
    patch: { name?: string; notes?: string; restSec?: number | null; pastMin?: number; startedAt?: number; exercises?: SessionExercise[] }
  ) =>
    call<Session>(`/api/sessions/${id}`, "PUT", patch),
  finishSession: (id: string) => call<{ session: Session | null; discarded: boolean }>(`/api/sessions/${id}/finish`, "POST", {}),
  deleteSession: (id: string) => call<{ ok: true }>(`/api/sessions/${id}`, "DELETE"),

  createExercise: (e: Omit<CustomExercise, "id" | "createdAt">) => call<CustomExercise>("/api/exercises", "POST", e),
  deleteExercise: (id: string) => call<{ ok: true }>(`/api/exercises/${id}`, "DELETE"),

  auth: {
    setup: (username: string, password: string) => call<{ me: Me }>("/api/auth/setup", "POST", { username, password }),
    login: (username: string, password: string) => call<{ me: Me }>("/api/auth/login", "POST", { username, password }),
    signup: (username: string, password: string) => call<{ me: Me }>("/api/auth/signup", "POST", { username, password }),
    logout: () => call<{ ok: true }>("/api/auth/logout", "POST", {}),
  },
  changePassword: (current: string, next: string) => call<{ ok: true }>("/api/account/password", "PUT", { current, next }),

  saveExercisePref: (exerciseId: string, patch: Partial<ExercisePref>) => call<ExercisePref>(`/api/exercise-prefs/${exerciseId}`, "PUT", patch),
  machines: {
    create: (m: Pick<Machine, "name" | "realKg" | "sticker">) => call<Machine>("/api/machines", "POST", m),
    update: (id: string, m: Pick<Machine, "name" | "realKg" | "sticker">) => call<Machine>(`/api/machines/${id}`, "PUT", m),
    remove: (id: string) => call<{ ok: true }>(`/api/machines/${id}`, "DELETE"),
  },
  saveBodyWeight: (date: string, kg: number | null, note: string) => call<BodyWeight[]>(`/api/bodyweight/${date}`, "PUT", { kg, note }),
  activities: {
    create: (a: ActivityBody) => call<Activity>("/api/activities", "POST", a),
    update: (id: string, a: ActivityBody) => call<Activity>(`/api/activities/${id}`, "PUT", a),
    remove: (id: string) => call<{ ok: true }>(`/api/activities/${id}`, "DELETE"),
  },

  push: {
    key: () => call<{ publicKey: string }>("/api/push"),
    subscribe: (sub: PushSubscriptionJSON) => call<{ ok: true }>("/api/push", "POST", sub),
    unsubscribe: (endpoint: string) => call<{ ok: true }>("/api/push", "DELETE", { endpoint }),
    test: (endpoint: string) => call<{ ok: true }>("/api/push/test", "POST", { endpoint }),
  },

  admin: {
    users: () => call<UserSummary[]>("/api/admin/users"),
    addUser: (username: string, password: string, isAdmin: boolean) => call<UserSummary[]>("/api/admin/users", "POST", { username, password, isAdmin }),
    updateUser: (id: string, patch: { isAdmin?: boolean; password?: string }) => call<UserSummary[]>(`/api/admin/users/${id}`, "PUT", patch),
    deleteUser: (id: string) => call<UserSummary[]>(`/api/admin/users/${id}`, "DELETE"),
    setSignupOpen: (signupOpen: boolean) => call<{ signupOpen: boolean }>("/api/admin/settings", "PUT", { signupOpen }),
  },
};

/**
 * Keep the server's copy of this browser's timer in step, for lock-screen alerts.
 * keepalive lets it finish while the page is being hidden or frozen. Failures are
 * ignored: the in-app alert still works.
 */
export function syncTimer(body: { endpoint: string; endAt: number | null; title?: string; label?: string; hidden: boolean; seq: number }) {
  fetch("/api/timer", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => {});
}
