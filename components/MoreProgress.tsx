"use client";

import { useMemo, useState } from "react";
import { SPORTS, SPORT_BY_ID, TREND, activityLine, activityMinutes, type Sport } from "@/lib/sports";
import { addDays, formatShort } from "@/lib/time";
import { fmtDist, round1, toUnit } from "@/lib/units";
import { useApp } from "./AppContext";
import { IconScale } from "./Icons";
import LineChart, { type ChartSeries } from "./LineChart";
import { SportIcon } from "./Sports";

/** Bodyweight and sports, side by side under the lift charts. */
export default function MoreProgress() {
  return (
    <div className="two-col">
      <BodyWeightPanel />
      <SportsPanel />
    </div>
  );
}

function BodyWeightPanel() {
  const { data, unit, today, openBodyWeight } = useApp();
  const pts = data.bodyWeights.filter((b) => b.kg != null);
  const series: ChartSeries[] = useMemo(
    () => [{ id: "bw", name: "Bodyweight", color: "#e4533d", points: pts.map((b) => ({ date: b.date, value: round1(toUnit(b.kg!, unit)), note: b.note || undefined })) }],
    [pts, unit] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const latest = pts[pts.length - 1];
  const monthAgo = [...pts].reverse().find((b) => b.date <= addDays(today, -30));
  const change = latest && monthAgo ? round1(toUnit(latest.kg!, unit) - toUnit(monthAgo.kg!, unit)) : null;
  const vals = series[0].points.map((p) => p.value);

  return (
    <section className="glass panel" aria-labelledby="bw-title">
      <div className="row-between">
        <h2 id="bw-title" className="subtitle">Bodyweight</h2>
        <button className="btn btn-ghost small-btn" onClick={() => openBodyWeight()}>
          <IconScale /> Log
        </button>
      </div>
      {pts.length === 0 ? (
        <p className="muted">Log your weight from the scale chip next to your name on Train, and it charts here.</p>
      ) : (
        <>
          <dl className="mini-stats">
            <div>
              <dt>Latest</dt>
              <dd className="num">
                {round1(toUnit(latest.kg!, unit))} <small>{unit}</small>
              </dd>
              <dd className="muted small">{formatShort(latest.date)}</dd>
            </div>
            {change != null && (
              <div>
                <dt>30 days</dt>
                <dd className="num">
                  {change > 0 ? "+" : ""}
                  {change} <small>{unit}</small>
                </dd>
              </div>
            )}
            {pts.length > 1 && (
              <div>
                <dt>Range</dt>
                <dd className="num">
                  {Math.min(...vals)}–{Math.max(...vals)}
                </dd>
              </div>
            )}
          </dl>
          {pts.length > 1 && (
            <LineChart series={series} format={(v) => `${round1(v)} ${unit}`} from={pts[0].date} to={today} height={200} label="Bodyweight over time" />
          )}
        </>
      )}
    </section>
  );
}

function SportsPanel() {
  const { data, today, openActivity } = useApp();
  const u = data.settings.distanceUnit;
  const played = SPORTS.filter((s) => data.activities.some((a) => a.sport === s.id));
  const latest = data.activities[data.activities.length - 1]?.sport;
  const [pick, setPick] = useState<Sport | null>(null);
  const sport = pick && played.some((s) => s.id === pick) ? pick : latest ?? null;
  const year = today.slice(0, 4);

  const list = useMemo(() => (sport ? data.activities.filter((a) => a.sport === sport) : []), [data.activities, sport]);
  const trend = sport ? TREND[sport] : null;
  const series: ChartSeries[] = useMemo(() => {
    if (!sport || !trend) return [];
    const points = list.map((a) => ({ date: a.date, value: trend.value(a, u) })).filter((p): p is { date: string; value: number } => p.value != null);
    return [{ id: sport, name: trend.label, color: "#2a78d6", points }];
  }, [list, sport, trend, u]);

  if (!sport || !trend)
    return (
      <section className="glass panel" aria-labelledby="sports-title">
        <h2 id="sports-title" className="subtitle">Sports</h2>
        <p className="muted">Log a run, hike, game or round and it charts here.</p>
        <div className="sport-chips wrap">
          {SPORTS.map((s) => (
            <button key={s.id} className="chip sport-chip" onClick={() => openActivity({ sport: s.id })}>
              <SportIcon sport={s.id} /> {s.short}
            </button>
          ))}
        </div>
      </section>
    );

  const thisYear = list.filter((a) => a.date.startsWith(year));
  const minutes = thisYear.reduce((n, a) => n + (a.durationSec ? activityMinutes(a) : 0), 0);
  const km = thisYear.reduce((n, a) => n + (a.distanceKm ?? 0), 0);
  const vals = series[0].points.map((p) => p.value);
  const best = vals.length ? (trend.lowerIsBetter ? Math.min(...vals) : Math.max(...vals)) : null;
  const games = sport === "badminton" || sport === "pickleball" ? thisYear.reduce((n, a) => n + (Number(a.data.games) || 0), 0) : 0;
  const won = games ? thisYear.reduce((n, a) => n + (Number(a.data.won) || 0), 0) : 0;

  return (
    <section className="glass panel" aria-labelledby="sports-title">
      <div className="row-between">
        <h2 id="sports-title" className="subtitle">Sports</h2>
        <button className="btn btn-ghost small-btn" onClick={() => openActivity({ sport })}>
          <SportIcon sport={sport} /> Log
        </button>
      </div>
      {played.length > 1 && (
        <div className="seg sport-seg" role="radiogroup" aria-label="Sport">
          {played.map((s) => (
            <button key={s.id} role="radio" aria-checked={sport === s.id} className={sport === s.id ? "on" : ""} onClick={() => setPick(s.id)}>
              {s.short}
            </button>
          ))}
        </div>
      )}
      <dl className="mini-stats">
        <div>
          <dt>{year}</dt>
          <dd className="num">{thisYear.length}</dd>
          <dd className="muted small">{thisYear.length === 1 ? "session" : "sessions"}</dd>
        </div>
        {minutes > 0 && (
          <div>
            <dt>Time</dt>
            <dd className="num">{minutes >= 120 ? `${Math.round(minutes / 6) / 10} h` : `${Math.round(minutes)} min`}</dd>
          </div>
        )}
        {km > 0 && (
          <div>
            <dt>Distance</dt>
            <dd className="num">{fmtDist(km, u)}</dd>
          </div>
        )}
        {games > 0 && (
          <div>
            <dt>Games won</dt>
            <dd className="num">
              {won}/{games}
            </dd>
          </div>
        )}
        {best != null && (
          <div>
            <dt>Best {trend.label.toLowerCase()}</dt>
            <dd className="num">{trend.fmt(best, u)}</dd>
          </div>
        )}
      </dl>
      {series[0].points.length > 1 && (
        <LineChart
          series={series}
          format={(v) => trend.fmt(v, u)}
          from={series[0].points[0].date}
          to={today}
          height={200}
          label={`${SPORT_BY_ID[sport].name}: ${trend.label.toLowerCase()} per session${trend.lowerIsBetter ? ", lower is better" : ""}`}
        />
      )}
      {trend.lowerIsBetter && series[0].points.length > 1 && <p className="muted small">Lower is better.</p>}
      <ul className="sport-recent">
        {[...list]
          .reverse()
          .slice(0, 5)
          .map((a) => (
            <li key={a.id}>
              <button onClick={() => openActivity({ id: a.id })}>
                <span className="muted small">{formatShort(a.date)}</span>
                <span>{activityLine(a, u)}</span>
              </button>
            </li>
          ))}
      </ul>
    </section>
  );
}
