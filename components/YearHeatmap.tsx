"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { addDays, dateToUtcNoon, formatShort } from "@/lib/time";
import { SPORT_BY_ID, activityMinutes } from "@/lib/sports";
import type { Activity, HistoryRow, SessionSummary } from "@/lib/types";
import { useApp } from "./AppContext";

type Props = { history: HistoryRow[]; sessions: SessionSummary[]; activities: Activity[]; today: string };

const LEFT = 30; // weekday labels
const TOP = 20; // month labels
const GAP = 3;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Shade by sets logged that day; a typical full session lands on the third step. */
const BINS = [
  { level: 1, max: 6, label: "1–6 sets" },
  { level: 2, max: 12, label: "7–12 sets" },
  { level: 3, max: 20, label: "13–20 sets" },
  { level: 4, max: Infinity, label: "21 or more sets" },
];
const levelFor = (sets: number) => (sets <= 0 ? 0 : BINS.find((b) => sets <= b.max)!.level);
/** Sports shade by minutes: up to 30, an hour, two hours, more */
const sportLevel = (min: number) => (min <= 0 ? 0 : min <= 30 ? 1 : min <= 60 ? 2 : min <= 120 ? 3 : 4);

const dow = (date: string) => new Date(dateToUtcNoon(date)).getUTCDay();
const longDay = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" });

/**
 * GitHub-style calendar of this year's training, one square per day, shaded by
 * sets lifted or minutes of sport, whichever is more. Clicking a day opens what was
 * done that day, or offers to log something for it.
 */
export default function YearHeatmap({ history, sessions, activities, today }: Props) {
  const { openWorkout, openActivity, openDay } = useApp();
  const year = today.slice(0, 4);
  const jan1 = `${year}-01-01`;
  const dec31 = `${year}-12-31`;
  const gridStart = addDays(jan1, -dow(jan1)); // the Sunday on or before Jan 1
  const weeks = Math.ceil((dateToUtcNoon(dec31) - dateToUtcNoon(gridStart)) / 86_400_000 / 7 + 1 / 7);

  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const [active, setActive] = useState<string | null>(null);
  const [fromKeys, setFromKeys] = useState(false);
  const [scrollX, setScrollX] = useState(0);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const step = Math.max(14, Math.min(20, Math.floor((width - LEFT) / weeks)));
  const cell = step - GAP;
  const svgW = LEFT + weeks * step;
  const svgH = TOP + 7 * step;

  // On narrow screens the year scrolls sideways; start at the current week.
  useLayoutEffect(() => {
    const el = wrap.current;
    if (el && svgW > el.clientWidth) {
      const col = Math.floor((dateToUtcNoon(today) - dateToUtcNoon(gridStart)) / 86_400_000 / 7);
      el.scrollLeft = Math.max(0, LEFT + col * step - el.clientWidth + step * 3);
      setScrollX(el.scrollLeft);
    }
  }, [svgW, step, today, gridStart]);

  const byDay = useMemo(() => {
    const m = new Map<string, { sets: number; names: string[]; sportMin: number; sports: string[] }>();
    const get = (date: string) => {
      let d = m.get(date);
      if (!d) m.set(date, (d = { sets: 0, names: [], sportMin: 0, sports: [] }));
      return d;
    };
    for (const r of history) if (r[1].slice(0, 4) === year) get(r[1]).sets++;
    for (const s of sessions) {
      const d = m.get(s.date);
      if (d && !d.names.includes(s.name)) d.names.push(s.name);
    }
    for (const a of activities) {
      if (a.date.slice(0, 4) !== year) continue;
      const d = get(a.date);
      const min = activityMinutes(a);
      d.sportMin += min;
      d.sports.push(`${SPORT_BY_ID[a.sport].name}${a.durationSec ? ` ${Math.round(min)} min` : ""}`);
    }
    return m;
  }, [history, sessions, activities, year]);

  // Everything done on each day (a day can hold several workouts and sports)
  const itemsOn = useMemo(() => {
    const m = new Map<string, ({ kind: "workout"; id: string } | { kind: "activity"; id: string })[]>();
    for (const s of sessions) m.set(s.date, [...(m.get(s.date) ?? []), { kind: "workout", id: s.id }]);
    for (const a of activities) m.set(a.date, [...(m.get(a.date) ?? []), { kind: "activity", id: a.id }]);
    return m;
  }, [sessions, activities]);
  const open = (date: string | null) => {
    if (!date || date > today) return;
    const items = itemsOn.get(date) ?? [];
    if (items.length === 1) return items[0].kind === "workout" ? openWorkout(items[0].id) : openActivity({ id: items[0].id });
    openDay(date);
  };

  const stats = useMemo(() => {
    const yearSessions = sessions.filter((s) => s.date.slice(0, 4) === year);
    const yearSports = activities.filter((a) => a.date.slice(0, 4) === year);
    const dates = [...yearSessions.map((s) => s.date), ...yearSports.map((a) => a.date)].sort();
    const first = dates[0] ?? null;
    const weeksSinceFirst = first ? Math.max(1, (dateToUtcNoon(today) - dateToUtcNoon(first)) / 86_400_000 / 7) : 1;
    // Weekly streak: consecutive weeks with a workout or sport, counting back from this
    // week (or from last week, if this week hasn't had one yet).
    const weekOf = (d: string) => addDays(d, -dow(d));
    const active = new Set([...sessions.map((s) => weekOf(s.date)), ...activities.map((a) => weekOf(a.date))]);
    let w = weekOf(today);
    if (!active.has(w)) w = addDays(w, -7);
    let streak = 0;
    while (active.has(w)) {
      streak++;
      w = addDays(w, -7);
    }
    const count = yearSessions.length + yearSports.length;
    return { count, workouts: yearSessions.length, sports: yearSports.length, days: [...byDay.keys()].length, first, perWeek: count / weeksSinceFirst, streak };
  }, [sessions, activities, byDay, today, year]);

  const pos = (date: string) => {
    const i = (dateToUtcNoon(date) - dateToUtcNoon(gridStart)) / 86_400_000;
    return { x: LEFT + Math.floor(i / 7) * step, y: TOP + (i % 7) * step };
  };

  const cells = [];
  for (let d = jan1; d <= dec31; d = addDays(d, 1)) {
    const { x, y } = pos(d);
    const future = d > today;
    const info = byDay.get(d);
    const lvl = future ? -1 : Math.max(levelFor(info?.sets ?? 0), sportLevel(info?.sportMin ?? 0));
    cells.push(<rect key={d} x={x} y={y} width={cell} height={cell} rx={3} className={`hm-cell hm-${lvl < 0 ? "future" : lvl}`} />);
  }

  const monthLabels = MONTHS.map((m, i) => {
    const first = `${year}-${String(i + 1).padStart(2, "0")}-01`;
    // Label the first full column of the month
    let col = Math.floor((dateToUtcNoon(first) - dateToUtcNoon(gridStart)) / 86_400_000 / 7);
    if (dow(first) > 0) col++;
    return { m, x: LEFT + col * step };
  });

  const dateAt = (e: { clientX: number; clientY: number; currentTarget: SVGSVGElement }) => {
    const r = e.currentTarget.getBoundingClientRect();
    const col = Math.floor((e.clientX - r.left - LEFT) / step);
    const row = Math.floor((e.clientY - r.top - TOP) / step);
    if (col < 0 || row < 0 || row > 6 || col >= weeks) return null;
    const d = addDays(gridStart, col * 7 + row);
    return d >= jan1 && d <= dec31 ? d : null;
  };

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    setFromKeys(false);
    setActive(dateAt(e));
  };

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const moves: Record<string, number> = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 };
    if (e.key === "Escape") return setActive(null);
    if ((e.key === "Enter" || e.key === " ") && active) {
      e.preventDefault();
      return open(active);
    }
    if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      setFromKeys(true);
      return setActive(e.key === "Home" ? jan1 : today);
    }
    if (!(e.key in moves)) return;
    e.preventDefault();
    setFromKeys(true);
    const next = addDays(active ?? today, moves[e.key]);
    if (next >= jan1 && next <= dec31) setActive(next);
  };

  const activeInfo = active ? byDay.get(active) : null;
  const activePos = active ? pos(active) : null;

  // Keyboard moves keep the chosen day in view
  useEffect(() => {
    const el = wrap.current;
    if (!el || !active || !fromKeys) return;
    const { x } = pos(active);
    if (x - LEFT < el.scrollLeft) el.scrollLeft = x - LEFT;
    else if (x + step > el.scrollLeft + el.clientWidth) el.scrollLeft = x + step - el.clientWidth + 8;
  }, [active, fromKeys]); // eslint-disable-line react-hooks/exhaustive-deps

  const frameW = wrap.current?.clientWidth ?? width;
  const row = active ? dow(active) : 0;

  return (
    <section className="glass panel heatmap" aria-labelledby="year-title">
      <div className="row-between">
        <h2 id="year-title" className="subtitle">{year}</h2>
        <div className="hm-legend" aria-hidden="true">
          <span className="muted small">Less</span>
          {[0, 1, 2, 3, 4].map((l) => (
            <svg key={l} width="13" height="13" viewBox="0 0 13 13">
              <rect width="13" height="13" rx="3" className={`hm-cell hm-${l}`} />
            </svg>
          ))}
          <span className="muted small">More</span>
        </div>
      </div>
      <p className="hm-summary">
        {stats.count ? (
          <>
            <span className="num">{stats.workouts}</span> {stats.workouts === 1 ? "workout" : "workouts"}
            {stats.sports > 0 && (
              <>
                {" "}and <span className="num">{stats.sports}</span> {stats.sports === 1 ? "sport session" : "sport sessions"}
              </>
            )}{" "}
            so far this year
            {stats.count > 1 && stats.first ? (
              <>
                , about <span className="num">{stats.perWeek.toFixed(1)}</span> a week since {formatShort(stats.first)}
              </>
            ) : null}
            .
            {stats.streak >= 2 && (
              <>
                {" "}You&rsquo;ve trained <span className="num">{stats.streak}</span> weeks in a row.
              </>
            )}
          </>
        ) : (
          <>Nothing logged in {year} yet. Each workout or sport fills in a square; tap a past day to log one for it.</>
        )}
      </p>

      <div className="hm-frame">
      <div className="hm-scroll" ref={wrap} onScroll={(e) => setScrollX(e.currentTarget.scrollLeft)}>
        <svg
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          role="img"
          tabIndex={0}
          aria-label={`Training per day in ${year}: ${stats.workouts} workouts and ${stats.sports} sport sessions on ${stats.days} days. Use the arrow keys to move between days and Enter to open a day.`}
          style={{ cursor: active && active <= today ? "pointer" : "default" }}
          onPointerMove={onMove}
          onClick={(e) => open(dateAt(e))}
          onPointerLeave={() => !fromKeys && setActive(null)}
          onKeyDown={onKey}
          onFocus={() => {
            setFromKeys(true);
            setActive((a) => a ?? today);
          }}
          onBlur={() => setActive(null)}
        >
          {monthLabels.map(({ m, x }) => (
            <text key={m} x={x} y={12} className="hm-label">
              {m}
            </text>
          ))}
          {[1, 3, 5].map((r) => (
            <text key={r} x={0} y={TOP + r * step + cell - 2} className="hm-label">
              {DAYS[r]}
            </text>
          ))}
          {cells}
          {today.slice(0, 4) === year && (() => {
            const p = pos(today);
            return <rect x={p.x - 1} y={p.y - 1} width={cell + 2} height={cell + 2} rx={4} className="hm-today" />;
          })()}
          {activePos && <rect x={activePos.x - 1.5} y={activePos.y - 1.5} width={cell + 3} height={cell + 3} rx={4.5} className="hm-active" />}
        </svg>
      </div>

        {active && activePos && (
          <div
            className="tip glass hm-tip"
            role="status"
            style={{
              left: Math.max(0, Math.min(activePos.x - scrollX - 60, frameW - 220)),
              // Below the square in the top rows, above it in the bottom rows
              ...(row < 4 ? { top: activePos.y + step + 4 } : { bottom: svgH - activePos.y + 6 }),
            }}
          >
            <div className="tip-date">{longDay.format(dateToUtcNoon(active))}</div>
            {active > today ? (
              <div>Still to come</div>
            ) : activeInfo ? (
              <>
                {activeInfo.sets > 0 && (
                  <div>
                    <strong className="num">{activeInfo.sets}</strong> sets{activeInfo.names.length ? `, ${activeInfo.names.join(" and ")}` : ""}
                  </div>
                )}
                {activeInfo.sports.length > 0 && <div>{activeInfo.sports.join(", ")}</div>}
                <div className="muted small">{fromKeys ? "Press Enter to open" : "Click to open"}</div>
              </>
            ) : (
              <>
                <div className="muted">Rest day</div>
                <div className="muted small">{fromKeys ? "Enter" : "Click"} to log something for it</div>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
