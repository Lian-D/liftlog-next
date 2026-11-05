"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { buildCatalog } from "@/lib/catalog";
import { addDays, formatLong, pacificDate, tzAbbr } from "@/lib/time";
import type { Bootstrap, Unit } from "@/lib/types";
import { Ctx, TABS, type AppCtx, type Tab } from "./AppContext";
import { IconBody, IconHistory, IconProgress, IconRoutines, IconTrain } from "./Icons";
import GuideDialog from "./GuideDialog";
import { AccountMenu } from "./Account";
import TrainView from "./TrainView";
import RoutinesView from "./RoutinesView";
import ExercisesView from "./ExercisesView";
import ProgressView from "./ProgressView";
import HistoryView from "./HistoryView";
import WorkoutDialog from "./WorkoutDialog";
import { TimerButton, TimerProvider } from "./Timer";
import { ActivityDialog } from "./Sports";
import { BodyWeightDialog } from "./BodyWeight";
import { PastWorkoutDialog } from "./PastWorkout";
import { DayDialog } from "./DayDialog";
import type { Sport } from "@/lib/sports";

const NAV: { id: Tab; label: string; Icon: typeof IconTrain }[] = [
  { id: "train", label: "Train", Icon: IconTrain },
  { id: "routines", label: "Routines", Icon: IconRoutines },
  { id: "exercises", label: "Exercises", Icon: IconBody },
  { id: "history", label: "History", Icon: IconHistory },
  { id: "progress", label: "Progress", Icon: IconProgress },
];

export default function App() {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("train");
  const [guideId, setGuideId] = useState<string | null>(null);
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [activity, setActivity] = useState<{ id: string } | { sport: Sport; date?: string } | null>(null);
  const [dayDate, setDayDate] = useState<string | null>(null);
  const [bwDate, setBwDate] = useState<string | null>(null);
  const [pastDate, setPastDate] = useState<string | null>(null);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [today, setToday] = useState("");
  const [tz, setTz] = useState("");
  const toastTimer = useRef<number | undefined>(undefined);

  const reload = useCallback(async () => {
    try {
      setData(await api.bootstrap());
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Keep the Pacific date current (it rolls over at Pacific midnight)
  useEffect(() => {
    const tick = () => {
      setToday(pacificDate());
      setTz(tzAbbr());
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Tab lives in the URL hash so reloads and the back button keep your place
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1) as Tab;
      if (TABS.includes(h)) setTab(h);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const go = useCallback((t: Tab) => {
    setTab(t);
    if (window.location.hash !== `#${t}`) window.history.pushState(null, "", `#${t}`);
    window.scrollTo({ top: 0 });
  }, []);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3800);
  }, []);

  const attempt = useCallback(
    async <T,>(fn: () => Promise<T>) => {
      try {
        return await fn();
      } catch (e) {
        notify((e as Error).message || "That didn't work. Check the server and try again.");
        return undefined;
      }
    },
    [notify]
  );

  const catalog = useMemo(() => buildCatalog(data?.customExercises ?? []), [data?.customExercises]);
  const unit: Unit = data?.settings.unit ?? "lb";

  const setUnit = (u: Unit) => {
    setData((d) => d && { ...d, settings: { ...d.settings, unit: u } });
    attempt(() => api.saveSettings({ unit: u }));
  };

  const editRoutine = useCallback(
    (id: string | null) => {
      setEditingRoutineId(id);
      if (id) go("routines");
    },
    [go]
  );

  if (!data) {
    return (
      <div className="boot">
        <div className="backdrop" />
        {loadError ? (
          <div className="glass boot-card" role="alert">
            <h1 className="title">Liftlog can&rsquo;t reach its database</h1>
            <p>{loadError}</p>
            <button className="btn btn-chalk" onClick={reload}>
              Try again
            </button>
          </div>
        ) : (
          <p className="boot-wait">Loading your log…</p>
        )}
      </div>
    );
  }

  const ctx: AppCtx = {
    data, setData, reload, unit, catalog, today: today || data.sessions[0]?.date || "", go,
    openGuide: setGuideId, openWorkout: setWorkoutId, editRoutine, editingRoutineId, notify, attempt,
    openActivity: setActivity,
    openDay: setDayDate,
    openBodyWeight: (d) => setBwDate(d ?? pacificDate()),
    openPastWorkout: (d) => setPastDate(d ?? addDays(pacificDate(), -1)),
  };

  const active = !!data.activeSession;

  const nav = (where: string) => (
    <nav className={`tabs ${where}`} aria-label="Sections">
      {NAV.map(({ id, label, Icon }) => (
        <a
          key={id}
          href={`#${id}`}
          className={`tab${tab === id ? " on" : ""}`}
          aria-current={tab === id ? "page" : undefined}
          onClick={(e) => {
            e.preventDefault();
            go(id);
          }}
        >
          <Icon />
          <span>{label}</span>
          {id === "train" && active && <i className="live-dot" aria-label="workout in progress" />}
        </a>
      ))}
    </nav>
  );

  return (
    <Ctx.Provider value={ctx}>
      <TimerProvider>
      <div className="backdrop" />
      <header className="topbar">
        <div className="topbar-inner">
          <a className="wordmark" href="#train" onClick={(e) => { e.preventDefault(); go("train"); }}>
            <svg viewBox="0 0 28 16" width="28" height="16" aria-hidden="true">
              <rect x="1" y="3" width="4" height="10" rx="1.5" />
              <rect x="6" y="1" width="3" height="14" rx="1.2" />
              <rect x="9" y="7" width="10" height="2" />
              <rect x="19" y="1" width="3" height="14" rx="1.2" />
              <rect x="23" y="3" width="4" height="10" rx="1.5" />
            </svg>
            Liftlog
          </a>
          {nav("tabs-top")}
          <div className="topbar-end">
            <span className="today">
              {today ? formatLong(today) : ""} <abbr title="Dates follow Pacific time">{tz}</abbr>
            </span>
            <div className="seg" role="radiogroup" aria-label="Weight unit">
              {(["lb", "kg"] as Unit[]).map((u) => (
                <button key={u} role="radio" aria-checked={unit === u} className={unit === u ? "on" : ""} onClick={() => setUnit(u)}>
                  {u}
                </button>
              ))}
            </div>
            <TimerButton />
            <AccountMenu />
          </div>
        </div>
      </header>

      <main className="page">
        {tab === "train" && <TrainView />}
        {tab === "routines" && <RoutinesView />}
        {tab === "exercises" && <ExercisesView />}
        {tab === "history" && <HistoryView />}
        {tab === "progress" && <ProgressView />}
      </main>

      {/* Phones get the same links as a bottom bar. It sits outside the header because the
          header's backdrop-filter would otherwise trap its fixed positioning. */}
      {nav("tabs-bottom")}

      <WorkoutDialog sessionId={workoutId} onClose={() => setWorkoutId(null)} />
      <GuideDialog exerciseId={guideId} onClose={() => setGuideId(null)} />
      <ActivityDialog target={activity} onClose={() => setActivity(null)} />
      <DayDialog date={dayDate} onClose={() => setDayDate(null)} />
      <BodyWeightDialog date={bwDate} onClose={() => setBwDate(null)} />
      <PastWorkoutDialog date={pastDate} onClose={() => setPastDate(null)} />

      <div className={`toast${toast ? " show" : ""}`} role="status" aria-live="polite">
        {toast}
      </div>
      </TimerProvider>
    </Ctx.Provider>
  );
}
