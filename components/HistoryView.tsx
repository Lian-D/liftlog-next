"use client";

import { useMemo, useState } from "react";
import { TZ } from "@/lib/time";
import { fmtBig, toUnit } from "@/lib/units";
import { SPORTS, SPORT_BY_ID, activityLine } from "@/lib/sports";
import { useApp } from "./AppContext";
import { IconClock } from "./Icons";
import { SportIcon } from "./Sports";
import YearHeatmap from "./YearHeatmap";

const PAGE = 30;
const monthFmt = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" });
const weekdayFmt = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" });
const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });

/** Every finished workout and sport, newest first, grouped by month. */
export default function HistoryView() {
  const { data, catalog, unit, today, openWorkout, openActivity, openPastWorkout } = useApp();
  const [routine, setRoutine] = useState("");
  const [shown, setShown] = useState(PAGE);

  // Sets, volume and exercises per workout, from the completed-set history
  const totals = useMemo(() => {
    const m = new Map<string, { sets: number; volumeKg: number; exercises: string[] }>();
    for (const [sid, , ex, reps, kg] of data.history) {
      const t = m.get(sid) ?? { sets: 0, volumeKg: 0, exercises: [] };
      t.sets++;
      t.volumeKg += reps * kg;
      if (!t.exercises.includes(ex)) t.exercises.push(ex);
      m.set(sid, t);
    }
    return m;
  }, [data.history]);

  type Item = { kind: "workout"; s: (typeof data.sessions)[number] } | { kind: "activity"; a: (typeof data.activities)[number] };
  const date = (i: Item) => (i.kind === "workout" ? i.s.date : i.a.date);
  const at = (i: Item) => (i.kind === "workout" ? i.s.startedAt : i.a.startedAt);

  const filters = useMemo(() => {
    const w = [...new Set(data.sessions.map((s) => s.name))].map((n) => ({ key: `w:${n}`, label: n, sport: null }));
    const sp = SPORTS.filter((x) => data.activities.some((a) => a.sport === x.id)).map((x) => ({ key: `s:${x.id}`, label: x.name, sport: x.id }));
    return [...w, ...sp];
  }, [data.sessions, data.activities]);

  const all: Item[] = useMemo(
    () =>
      [...data.sessions.map((s): Item => ({ kind: "workout", s })), ...data.activities.map((a): Item => ({ kind: "activity", a }))].sort((x, y) => at(y) - at(x)),
    [data.sessions, data.activities] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const list = all.filter((i) => !routine || (i.kind === "workout" ? `w:${i.s.name}` === routine : `s:${i.a.sport}` === routine));
  const visible = list.slice(0, shown);

  const months: { key: string; label: string; items: Item[] }[] = [];
  for (const i of visible) {
    const key = date(i).slice(0, 7);
    let m = months[months.length - 1];
    if (!m || m.key !== key) months.push((m = { key, label: monthFmt.format(Date.parse(`${date(i)}T12:00:00Z`)), items: [] }));
    m.items.push(i);
  }
  const monthCount = (key: string) => {
    const inMonth = list.filter((i) => date(i).startsWith(key));
    const w = inMonth.filter((i) => i.kind === "workout").length;
    const sp = inMonth.length - w;
    return [w ? `${w} ${w === 1 ? "workout" : "workouts"}` : "", sp ? `${sp} ${sp === 1 ? "sport" : "sports"}` : ""].filter(Boolean).join(", ");
  };
  const empty = data.sessions.length === 0 && data.activities.length === 0;

  return (
    <div className="stack">
      <div className="page-head">
        <h1 className="title">History</h1>
        <button className="btn btn-ghost" onClick={() => openPastWorkout()}>
          <IconClock /> Log a past workout
        </button>
      </div>

      {empty ? (
        <section className="glass panel empty-panel">
          <p>Workouts and sports you log show up here, with every set. Missed logging one? Use <strong>Log a past workout</strong>.</p>
        </section>
      ) : (
        <>
          <YearHeatmap history={data.history} sessions={data.sessions} activities={data.activities} today={today} />

          {filters.length > 1 && (
            <div className="chips" role="group" aria-label="Show">
              <button className={`chip${!routine ? " on" : ""}`} aria-pressed={!routine} onClick={() => setRoutine("")}>
                All
              </button>
              {filters.map((f) => (
                <button key={f.key} className={`chip${routine === f.key ? " on" : ""}`} aria-pressed={routine === f.key} onClick={() => setRoutine(f.key)}>
                  {f.sport && <SportIcon sport={f.sport} />} {f.label}
                </button>
              ))}
            </div>
          )}

          {months.map((m) => (
            <section key={m.key} className="hist-month" aria-labelledby={`m-${m.key}`}>
              <div className="hist-month-head">
                <h2 id={`m-${m.key}`} className="subtitle">{m.label}</h2>
                <span className="muted small">{monthCount(m.key)}</span>
              </div>
              <ul className="hist-list">
                {m.items.map((i) => {
                  const d = date(i);
                  const noon = Date.parse(`${d}T12:00:00Z`);
                  const dateBadge = (
                    <span className={`hist-date${d === today ? " is-today" : ""}`} aria-hidden="true">
                      <span className="hist-day">{Number(d.slice(8))}</span>
                      <span className="hist-wd">{weekdayFmt.format(noon)}</span>
                    </span>
                  );
                  if (i.kind === "activity") {
                    const a = i.a;
                    return (
                      <li key={a.id}>
                        <button className="glass hist-row hist-sport" onClick={() => openActivity({ id: a.id })}>
                          {dateBadge}
                          <span className="hist-main">
                            <span className="hist-name">
                              <SportIcon sport={a.sport} /> {SPORT_BY_ID[a.sport].name}
                            </span>
                            <span className="hist-meta">
                              {activityLine(a, data.settings.distanceUnit)}
                              <span className="sr-only">, {weekdayFmt.format(noon)} {d}</span>
                            </span>
                          </span>
                          <span className="hist-exercises" aria-hidden="true">
                            {[a.data.place, a.notes].filter(Boolean).join(" · ")}
                          </span>
                          <span className="hist-time muted small">{timeFmt.format(a.startedAt)}</span>
                        </button>
                      </li>
                    );
                  }
                  const s = i.s;
                  const t = totals.get(s.id) ?? { sets: 0, volumeKg: 0, exercises: [] };
                  const mins = Math.max(1, Math.round((s.finishedAt - s.startedAt) / 60_000));
                  return (
                    <li key={s.id}>
                      <button className="glass hist-row" onClick={() => openWorkout(s.id)}>
                        {dateBadge}
                        <span className="hist-main">
                          <span className="hist-name">{s.name}</span>
                          <span className="hist-meta">
                            {t.sets} sets{t.volumeKg > 0 ? `, ${fmtBig(toUnit(t.volumeKg, unit))} ${unit}` : ""}, {mins} min
                            <span className="sr-only">, {weekdayFmt.format(noon)} {d}</span>
                          </span>
                        </span>
                        <span className="hist-exercises" aria-hidden="true">
                          {t.exercises.slice(0, 3).map((id) => catalog.get(id).name).join(", ")}
                          {t.exercises.length > 3 ? ` and ${t.exercises.length - 3} more` : ""}
                        </span>
                        <span className="hist-time muted small">{timeFmt.format(s.startedAt)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          {list.length > shown && (
            <button className="btn btn-ghost show-all" onClick={() => setShown((n) => n + PAGE)}>
              Show older
            </button>
          )}

          <p className="muted small export">
            <a href="/api/export" download>
              Download all your data
            </a>{" "}
            as JSON, for backups or moving to another app.
          </p>
        </>
      )}
    </div>
  );
}
