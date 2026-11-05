"use client";

import { useMemo } from "react";
import { addDays, dateToUtcNoon, formatRelative } from "@/lib/time";
import { fmtBig, toUnit } from "@/lib/units";
import { SPORT_BY_ID, activityLine } from "@/lib/sports";
import { useApp } from "./AppContext";
import { IconBolt, IconCalendar, IconFlame, IconTrain } from "./Icons";
import { SportIcon } from "./Sports";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** Monday-based weekday: 0 = Monday */
const weekday = (d: string) => (new Date(dateToUtcNoon(d)).getUTCDay() + 6) % 7;
const mondayOf = (d: string) => addDays(d, -weekday(d));

/** Greeting and this week's numbers at the top of the Train tab. */
export default function Activity() {
  const { data, unit, today, openWorkout, openActivity } = useApp();
  const h = data.history;

  const s = useMemo(() => {
    const monday = mondayOf(today);
    const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
    const sets = new Map<string, number>();
    const volByWeek = new Map<string, number>();
    for (const [, date, , reps, kg] of h) {
      sets.set(date, (sets.get(date) ?? 0) + 1);
      const w = mondayOf(date);
      volByWeek.set(w, (volByWeek.get(w) ?? 0) + reps * kg);
    }
    const sportDays = new Map<string, string[]>();
    for (const a of data.activities) sportDays.set(a.date, [...(sportDays.get(a.date) ?? []), SPORT_BY_ID[a.sport].name]);
    const week = days.map((d) => ({ d, sets: sets.get(d) ?? 0, sports: sportDays.get(d) ?? [] }));
    const workouts = data.sessions.filter((x) => x.date >= monday).length;
    const sports = data.activities.filter((x) => x.date >= monday).length;

    // Volume per week for the last 8 weeks, oldest first
    const vols = Array.from({ length: 8 }, (_, i) => volByWeek.get(addDays(monday, -7 * (7 - i))) ?? 0);

    // Weeks in a row with a workout, counting back from this week (or last week, if this one is still empty)
    const active = new Set([...data.sessions.map((x) => mondayOf(x.date)), ...data.activities.map((x) => mondayOf(x.date))]);
    let w = active.has(monday) ? monday : addDays(monday, -7);
    let streak = 0;
    while (active.has(w)) {
      streak++;
      w = addDays(w, -7);
    }

    return { week, workouts, sports, weekSets: week.reduce((n, x) => n + x.sets, 0), vols, volume: vols[7], streak };
  }, [h, data.sessions, data.activities, today]);

  const top = Math.max(20, ...s.week.map((x) => x.sets));
  const last = data.sessions[0];
  const lastSport = data.activities[data.activities.length - 1];
  const sportIsLatest = !!lastSport && (!last || lastSport.startedAt > last.startedAt);
  const lastRows = last ? h.filter((r) => r[0] === last.id) : [];
  const lastVol = lastRows.reduce((n, r) => n + r[3] * r[4], 0);

  // Sparkline for the volume card (viewBox 100 × 40): the line rides the top half and its
  // wash fills down behind the number, like the heart-rate card in the reference
  const vmax = Math.max(1, ...s.vols);
  const pts = s.vols.map((v, i) => [(i / (s.vols.length - 1)) * 100, 22 - (v / vmax) * 18]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");

  return (
    <section className="stack" aria-labelledby="activity-title">
      <h2 id="activity-title" className="title title-2">Your activity</h2>

      <div className="activity">
        <article className="glass act-card act-week">
          <div className="act-head">
            <span>
              <IconCalendar /> This week
            </span>
            <span className="muted">{s.weekSets} sets</span>
          </div>
          <p className="act-value">
            {s.workouts}
            <span className="unit">{s.workouts === 1 ? "workout" : "workouts"}</span>
            {s.sports > 0 && (
              <>
                {" "}+ {s.sports}
                <span className="unit">{s.sports === 1 ? "sport" : "sports"}</span>
              </>
            )}
          </p>
          <div
            className="act-bars"
            role="img"
            aria-label={`Sets per day this week: ${s.week.map((x, i) => `${DAY_LABELS[i]} ${x.sets}${x.sports.length ? ` plus ${x.sports.join(" and ")}` : ""}`).join(", ")}`}
          >
            {s.week.map((x, i) => (
              <div key={x.d} className="act-bar">
                <div className="act-col">
                  {x.sets > 0 && <div className="act-fill" style={{ height: `${Math.max(8, (x.sets / top) * 100)}%` }} />}
                  {x.sports.length > 0 && <i className="act-sport" title={x.sports.join(", ")} />}
                </div>
                <span className={`act-day${x.d === today ? " is-today" : ""}`}>{DAY_LABELS[i]}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="glass act-card">
          <div className="act-head">
            <span>
              <IconBolt /> Week volume
            </span>
          </div>
          <svg className="act-spark" viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label="Weekly volume over the last 8 weeks">
            <defs>
              <linearGradient id="act-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#ee5d47" stopOpacity="0.32" />
                <stop offset="1" stopColor="#ee5d47" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={`${line}L100,40L0,40Z`} fill="url(#act-area)" />
            <path d={line} className="line" vectorEffect="non-scaling-stroke" />
          </svg>
          <p className="act-value">
            {fmtBig(toUnit(s.volume, unit))}
            <span className="unit">{unit}</span>
          </p>
        </article>

        <article className="glass act-card">
          <div className="act-head">
            <span>
              <IconFlame /> Streak
            </span>
          </div>
          <p className="act-value">
            {s.streak}
            <span className="unit">{s.streak === 1 ? "week" : "weeks"}</span>
          </p>
          <p className="act-note">{s.streak ? "in a row with a workout or sport" : "Finish a workout to start one"}</p>
        </article>

        {sportIsLatest ? (
          <article className="glass act-card act-last clickable" onClick={() => openActivity({ id: lastSport.id })}>
            <div className="act-head">
              <span>
                <SportIcon sport={lastSport.sport} /> Last activity
              </span>
              <span className="muted">{formatRelative(lastSport.date, today)}</span>
            </div>
            <p className="act-value act-name">
              <button className="link-btn" onClick={(e) => { e.stopPropagation(); openActivity({ id: lastSport.id }); }}>
                {SPORT_BY_ID[lastSport.sport].name}
              </button>
            </p>
            <p className="act-note">{activityLine(lastSport, data.settings.distanceUnit)}</p>
          </article>
        ) : (
        <article
          className={`glass act-card act-last${last ? " clickable" : ""}`}
          onClick={last ? () => openWorkout(last.id) : undefined}
        >
          <div className="act-head">
            <span>
              <IconTrain /> Last workout
            </span>
            {last && <span className="muted">{formatRelative(last.date, today)}</span>}
          </div>
          {last ? (
            <>
              <p className="act-value act-name">
                <button className="link-btn" onClick={(e) => { e.stopPropagation(); openWorkout(last.id); }}>
                  {last.name}
                </button>
              </p>
              <p className="act-note">
                {lastRows.length} sets, {fmtBig(toUnit(lastVol, unit))} {unit}
              </p>
            </>
          ) : (
            <p className="act-note">Nothing logged yet. Pick a routine below to start.</p>
          )}
        </article>
        )}
      </div>
    </section>
  );
}
