"use client";

import { useEffect, useMemo, useState } from "react";
import { MUSCLES } from "@/lib/muscles";
import { METRICS, muscleSets, normalise, seriesFor, type Metric } from "@/lib/stats";
import { addDays, formatShortYear } from "@/lib/time";
import type { HistoryRow } from "@/lib/types";
import { fmtBig, fmtWeight, round1, toUnit } from "@/lib/units";
import { useApp } from "./AppContext";
import BodyMap from "./BodyMap";
import LineChart, { Sparkline, type ChartSeries } from "./LineChart";
import YearHeatmap from "./YearHeatmap";
import MoreProgress from "./MoreProgress";

/** Categorical slots checked for colour-blind separation on the light glass surface (see README, chart colours). */
const SLOTS = ["#e4533d", "#2a78d6", "#1baf7a", "#c98500", "#6250d6", "#d55181"];

const RANGES = [
  { id: "4w", short: "4 wk", label: "4 weeks", days: 28 },
  { id: "3m", short: "3 mo", label: "3 months", days: 91 },
  { id: "6m", short: "6 mo", label: "6 months", days: 182 },
  { id: "1y", short: "1 yr", label: "1 year", days: 365 },
  { id: "all", short: "All", label: "all time", days: 0 },
] as const;
type RangeId = (typeof RANGES)[number]["id"];

export default function ProgressView() {
  const { data, catalog, unit, today, notify, openGuide, go } = useApp();
  const [routineId, setRoutineId] = useState("");
  const [range, setRange] = useState<RangeId>("3m");
  const [metric, setMetric] = useState<Metric>("e1rm");
  const [slots, setSlots] = useState<Record<string, number>>({});
  const [asTable, setAsTable] = useState(false);
  const [indexed, setIndexed] = useState(false);
  const [moreLifts, setMoreLifts] = useState(false);

  const h = data.history;
  const firstDate = h.length ? h[0][1] : today;
  const days = RANGES.find((r) => r.id === range)!.days;
  const from = days ? addDays(today, -(days - 1)) : firstDate < today ? firstDate : addDays(today, -27);
  const inRange = useMemo(() => h.filter((r) => r[1] >= from), [h, from]);

  // Lifts that can be charted: weighted exercises with logged load in range
  const candidates = useMemo(() => {
    const routine = data.routines.find((r) => r.id === routineId);
    const sessions = new Map<string, Set<string>>();
    for (const [sid, , ex, , kg] of inRange) {
      if (kg <= 0 || catalog.get(ex).measure !== "weight") continue;
      if (!sessions.has(ex)) sessions.set(ex, new Set());
      sessions.get(ex)!.add(sid);
    }
    if (routine) return routine.items.map((i) => i.exerciseId).filter((id) => sessions.has(id));
    // Most-trained first; among equals, the heavier (usually compound) lifts lead
    const best = (id: string) => Math.max(0, ...seriesFor(inRange, id, "e1rm").map((p) => p.value));
    return [...sessions.entries()]
      .map(([id, s]) => ({ id, n: s.size, b: best(id) }))
      .sort((a, b) => b.n - a.n || b.b - a.b)
      .map((x) => x.id);
  }, [inRange, routineId, data.routines, catalog]);

  // Default selection: the first four candidates. Colours stay with a lift while it's selected.
  useEffect(() => {
    setSlots((cur) => {
      const kept = Object.fromEntries(Object.entries(cur).filter(([id]) => candidates.includes(id)));
      if (Object.keys(kept).length) return kept;
      return Object.fromEntries(candidates.slice(0, 4).map((id, i) => [id, i]));
    });
  }, [candidates]);

  const toggleLift = (id: string) =>
    setSlots((cur) => {
      if (id in cur) {
        const { [id]: _drop, ...rest } = cur;
        return rest;
      }
      const used = new Set(Object.values(cur));
      const free = SLOTS.findIndex((_, i) => !used.has(i));
      if (free < 0) {
        notify("Up to six lifts at a time. Turn one off first.");
        return cur;
      }
      return { ...cur, [id]: free };
    });

  const conv = (kg: number) => (metric === "volume" ? toUnit(kg, unit) : round1(toUnit(kg, unit)));
  const fmt = indexed
    ? (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(round1(v))}%`
    : (v: number) => (metric === "volume" ? fmtBig(v) : String(round1(v)));

  const series: ChartSeries[] = candidates
    .filter((id) => id in slots)
    .map((id) => {
      const pts = seriesFor(h, id, metric, from);
      const base = pts[0]?.value || 1;
      return {
        id,
        name: catalog.get(id).name,
        color: SLOTS[slots[id]],
        points: pts.map((p) => ({
          date: p.date,
          // % change indexes every lift to its first workout in range, so small and big lifts share one axis honestly
          value: indexed ? round1((p.value / base - 1) * 100) : conv(p.value),
          note: `top ${fmtWeight(p.topKg, unit)} × ${p.topReps}`,
        })),
      };
    });

  // Range summary
  const summary = useMemo(() => {
    const sessions = new Set(inRange.map((r) => r[0]));
    let vol = 0;
    for (const r of inRange) vol += r[3] * r[4];
    return { workouts: sessions.size, sets: inRange.length, volumeKg: vol };
  }, [inRange]);

  // Muscles hit in the last 7 days
  const week = useMemo(() => {
    const since = addDays(today, -6);
    const counts = new Map<string, number>();
    for (const r of h) if (r[1] >= since) counts.set(r[2], (counts.get(r[2]) ?? 0) + 1);
    return muscleSets([...counts].map(([exerciseId, sets]) => ({ exerciseId, sets })), catalog);
  }, [h, today, catalog]);
  const weekRows = MUSCLES.map((m) => ({ ...m, sets: week[m.id] ?? 0 })).filter((m) => m.sets > 0).sort((a, b) => b.sets - a.sets);

  const metricInfo = METRICS.find((x) => x.id === metric)!;
  const rangeLabel = RANGES.find((r) => r.id === range)!;


  if (!h.length) {
    return (
      <div className="stack">
        <div className="page-head">
          <h1 className="title">Progress</h1>
        </div>
        {data.activities.length > 0 && <YearHeatmap history={h} sessions={data.sessions} activities={data.activities} today={today} />}
        <section className="glass panel empty-panel">
          <p>Finish a workout and your lifts start charting here, one point per session.</p>
        </section>
        <MoreProgress />
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="page-head">
        <h1 className="title">Progress</h1>
      </div>

      <YearHeatmap history={h} sessions={data.sessions} activities={data.activities} today={today} />

      <div className="filters" role="group" aria-label="Chart filters">
        <div className="seg" role="radiogroup" aria-label="Time range">
          {RANGES.map((r) => (
            <button key={r.id} role="radio" aria-label={r.label} aria-checked={range === r.id} className={range === r.id ? "on" : ""} onClick={() => setRange(r.id)}>
              {r.short}
            </button>
          ))}
        </div>
        <select value={routineId} onChange={(e) => setRoutineId(e.target.value)} aria-label="Lifts from">
          <option value="">All lifts</option>
          {data.routines.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <div className="seg" role="radiogroup" aria-label="Measure">
          {METRICS.map((x) => (
            <button key={x.id} role="radio" aria-checked={metric === x.id} className={metric === x.id ? "on" : ""} onClick={() => setMetric(x.id)}>
              {x.label}
            </button>
          ))}
        </div>
      </div>

      <p className="lede">
        {summary.workouts ? (
          <>
            <span className="num">{summary.workouts}</span> {summary.workouts === 1 ? "workout" : "workouts"}, <span className="num">{summary.sets}</span> sets and{" "}
            <span className="num">{fmtBig(toUnit(summary.volumeKg, unit))}</span> {unit} lifted {range === "all" ? "in total" : `in the last ${rangeLabel.label}`}.
          </>
        ) : (
          <>No workouts in the last {rangeLabel.label}.</>
        )}
      </p>

      <section className="glass panel chart-panel" aria-labelledby="chart-title">
        <div className="row-between">
          <div>
            <h2 id="chart-title" className="subtitle">{metricInfo.long}</h2>
            <p className="muted small">
              {indexed
                ? "Change from each lift's first workout in this range"
                : metric === "volume"
                  ? `${unit} × reps per workout`
                  : `${unit}, best set per workout`}
              {metric === "e1rm" ? ", estimated from sets of 12 reps or fewer" : ""}
            </p>
          </div>
          <div className="row-gap">
            <div className="seg" role="radiogroup" aria-label="Scale">
              <button role="radio" aria-checked={!indexed} className={!indexed ? "on" : ""} onClick={() => setIndexed(false)}>
                {metric === "volume" ? "Volume" : unit}
              </button>
              <button role="radio" aria-checked={indexed} className={indexed ? "on" : ""} onClick={() => setIndexed(true)}>
                % change
              </button>
            </div>
            <button className="btn btn-ghost" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
              {asTable ? "Show chart" : "Show table"}
            </button>
          </div>
        </div>

        {candidates.length ? (
          <>
            <div className="legend" role="group" aria-label="Lifts on the chart">
              {candidates
                .filter((id) => moreLifts || id in slots || candidates.length <= 6)
                .map((id) => {
                  const on = id in slots;
                  return (
                    <button key={id} className={`legend-item${on ? " on" : ""}`} aria-pressed={on} onClick={() => toggleLift(id)}>
                      <span className="key" style={on ? { background: SLOTS[slots[id]] } : undefined} />
                      {catalog.get(id).name}
                    </button>
                  );
                })}
              {candidates.length > 6 && (
                <button className="legend-item legend-more" aria-expanded={moreLifts} onClick={() => setMoreLifts((v) => !v)}>
                  {moreLifts ? "Fewer lifts" : `${candidates.filter((id) => !(id in slots)).length} more lifts`}
                </button>
              )}
            </div>
            {series.length === 0 ? (
              <p className="muted chart-empty">Turn on a lift above to chart it.</p>
            ) : asTable ? (
              <ChartTable series={series} format={fmt} />
            ) : (
              <LineChart
                series={series}
                format={fmt}
                from={from}
                to={today}
                label={`${metricInfo.long} ${indexed ? "as % change" : `in ${unit}`} for ${series.map((s) => s.name).join(", ")}. Use the arrow keys to step through workouts.`}
              />
            )}
          </>
        ) : (
          <p className="muted chart-empty">No weighted lifts logged {routineId ? "from this routine " : ""}in this range.</p>
        )}
      </section>

      <div className="two-col">
        <section className="glass panel" aria-labelledby="lifts-title">
          <h2 id="lifts-title" className="subtitle">Lifts</h2>
          <LiftTable history={h} from={from} ids={candidates} onOpen={openGuide} />
        </section>

        <section className="glass panel" aria-labelledby="week-title">
          <h2 id="week-title" className="subtitle">Last 7 days</h2>
          <div className="week">
            <BodyMap label="Sets per muscle in the last 7 days" intensity={normalise(week, 16)} compact />
            {weekRows.length ? (
              <ul className="week-list">
                {weekRows.map((m) => (
                  <li key={m.id}>
                    <span>{m.label}</span>
                    <span className="num">{Number.isInteger(m.sets) ? m.sets : m.sets.toFixed(1)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Nothing logged this week.</p>
            )}
          </div>
          <p className="muted small">Sets per muscle. A muscle that only assists counts half a set.</p>
        </section>
      </div>

      <MoreProgress />

      <p className="muted small">
        Every workout, with all its sets, is under{" "}
        <button className="link-btn" onClick={() => go("history")}>
          History
        </button>
        . Click a day on the year above to open it.
      </p>
    </div>
  );
}

function ChartTable({ series, format }: { series: ChartSeries[]; format: (v: number) => string }) {
  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort().reverse();
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Date</th>
            {series.map((s) => (
              <th key={s.id} scope="col">
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dates.map((d) => (
            <tr key={d}>
              <th scope="row">{formatShortYear(d)}</th>
              {series.map((s) => {
                const p = s.points.find((x) => x.date === d);
                return (
                  <td key={s.id} className="num">
                    {p ? format(p.value) : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LiftTable({ history, from, ids, onOpen }: { history: HistoryRow[]; from: string; ids: string[]; onOpen: (id: string) => void }) {
  const { catalog, unit } = useApp();
  if (!ids.length) return <p className="muted">No weighted lifts in this range.</p>;
  return (
    <ul className="lifts">
      {ids.map((id) => {
        const pts = seriesFor(history, id, "e1rm", from);
        const all = seriesFor(history, id, "e1rm");
        const best = Math.max(0, ...all.map((p) => p.value));
        const last = pts[pts.length - 1];
        const first = pts[0];
        const change = first && last && pts.length > 1 ? ((last.value - first.value) / first.value) * 100 : null;
        const name = catalog.get(id).name;
        return (
          <li key={id}>
            <button className="link-btn lift-name" onClick={() => onOpen(id)}>
              {name}
            </button>
            <Sparkline values={pts.map((p) => p.value)} label={`${name} estimated 1RM trend`} />
            <span className="lift-stat">
              <span className="num">{fmtWeight(best, unit)}</span>
              <span className="muted small">best e1RM</span>
            </span>
            <span className="lift-stat">
              <span className="num">{last ? `${fmtWeight(last.topKg, unit)} × ${last.topReps}` : "–"}</span>
              <span className="muted small">last top set</span>
            </span>
            <span className={`lift-change num${change == null ? "" : change >= 0 ? " up" : " down"}`}>
              {change == null ? "" : `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(1)}%`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
