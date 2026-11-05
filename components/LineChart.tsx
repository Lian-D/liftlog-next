"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { dateToUtcNoon, formatShort, formatShortYear } from "@/lib/time";

export type ChartPoint = { date: string; value: number; note?: string };
export type ChartSeries = { id: string; name: string; color: string; points: ChartPoint[] };

type Props = {
  series: ChartSeries[];
  /** Formats a y value for ticks, labels and the tooltip */
  format: (v: number) => string;
  /** First and last calendar day shown */
  from: string;
  to: string;
  height?: number;
  label: string;
};

function niceTicks(min: number, max: number, count = 4) {
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.1);
    min -= pad;
    max += pad;
  }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

/** Multi-series line chart: one shared y axis, crosshair tooltip, keyboard stepping, direct end labels. */
export default function LineChart({ series, format, from, to, height = 300, label }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [ptr, setPtr] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const values = series.flatMap((s) => s.points.map((p) => p.value));
  const ticks = values.length ? niceTicks(Math.min(...values), Math.max(...values)) : [0, 1];
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];

  const narrow = width < 520;
  const endLabels = series.length > 0 && series.length <= 4 && !narrow;
  const m = { top: 14, right: endLabels ? 128 : 18, bottom: 30, left: 52 };
  const iw = width - m.left - m.right;
  const ih = height - m.top - m.bottom;

  const t0 = dateToUtcNoon(from);
  const t1 = Math.max(dateToUtcNoon(to), t0 + 86_400_000);
  const x = (date: string) => m.left + ((dateToUtcNoon(date) - t0) / (t1 - t0)) * iw;
  const y = (v: number) => m.top + (1 - (v - yMin) / (yMax - yMin || 1)) * ih;

  // Every date that has at least one point, for the crosshair to snap to
  const dates = useMemo(() => [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort(), [series]);
  const activeDate = hoverX == null ? null : dates[hoverX];

  const xTicks = useMemo(() => {
    const spanDays = (t1 - t0) / 86_400_000;
    const n = Math.max(2, Math.min(6, Math.floor(iw / 110)));
    const multiYear = from.slice(0, 4) !== to.slice(0, 4) && spanDays > 300;
    return Array.from({ length: n }, (_, i) => {
      const t = t0 + ((t1 - t0) * i) / (n - 1);
      const d = new Date(t).toISOString().slice(0, 10);
      return { px: m.left + (i / (n - 1)) * iw, text: multiYear ? formatShortYear(d) : formatShort(d) };
    });
  }, [t0, t1, iw, m.left, from, to]);

  // End labels: drop them if any two would collide
  const ends = series
    .filter((s) => s.points.length)
    .map((s) => ({ s, p: s.points[s.points.length - 1] }))
    .map((e) => ({ ...e, ly: y(e.p.value) }))
    .sort((a, b) => a.ly - b.ly);
  const labelsFit = endLabels && ends.every((e, i) => i === 0 || e.ly - ends[i - 1].ly >= 30);

  const nearest = (px: number) => {
    if (!dates.length) return null;
    let best = 0;
    let bd = Infinity;
    dates.forEach((d, i) => {
      const dist = Math.abs(x(d) - px);
      if (dist < bd) {
        bd = dist;
        best = i;
      }
    });
    return best;
  };

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * width;
    setHoverX(nearest(px));
    setPtr({ x: e.clientX - r.left, y: e.clientY - r.top });
  };

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (!dates.length) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const cur = hoverX ?? (e.key === "ArrowRight" ? -1 : dates.length);
      const next = Math.max(0, Math.min(dates.length - 1, cur + (e.key === "ArrowRight" ? 1 : -1)));
      setHoverX(next);
      setPtr({ x: (x(dates[next]) / width) * (wrap.current?.clientWidth ?? width), y: m.top + 20 });
    } else if (e.key === "Escape") {
      setHoverX(null);
    }
  };

  const tipRows = activeDate
    ? series
        .map((s) => ({ s, p: s.points.find((p) => p.date === activeDate) }))
        .filter((r): r is { s: ChartSeries; p: ChartPoint } => !!r.p)
        .sort((a, b) => b.p.value - a.p.value)
    : [];

  const showDots = series.every((s) => s.points.length <= 40);

  return (
    <div className="chart" ref={wrap}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label}
        tabIndex={0}
        onPointerMove={onMove}
        onPointerLeave={() => setHoverX(null)}
        onKeyDown={onKey}
        onBlur={() => setHoverX(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} className="grid" />
            <text x={m.left - 10} y={y(t)} dy="0.32em" textAnchor="end" className="axis">
              {format(t)}
            </text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <text key={i} x={t.px} y={height - 8} textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"} className="axis">
            {t.text}
          </text>
        ))}

        {activeDate && <line x1={x(activeDate)} x2={x(activeDate)} y1={m.top} y2={m.top + ih} className="crosshair" />}

        {series.map((s) => {
          if (!s.points.length) return null;
          const d = s.points.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join("");
          const last = s.points[s.points.length - 1];
          const lone = series.length === 1 && s.points.length > 1;
          const gid = `area-${s.id}`;
          return (
            <g key={s.id}>
              {lone && (
                <>
                  <defs>
                    <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor={s.color} stopOpacity={0.28} />
                      <stop offset="1" stopColor={s.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <path d={`${d}L${x(last.date).toFixed(1)},${m.top + ih}L${x(s.points[0].date).toFixed(1)},${m.top + ih}Z`} fill={`url(#${gid})`} />
                </>
              )}
              <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {showDots &&
                s.points.slice(0, -1).map((p) => (
                  <circle key={p.date} cx={x(p.date)} cy={y(p.value)} r={2.5} fill={s.color} className="dot" />
                ))}
              <circle cx={x(last.date)} cy={y(last.value)} r={4} fill={s.color} className="dot ring" />
              {activeDate &&
                s.points
                  .filter((p) => p.date === activeDate)
                  .map((p) => <circle key="h" cx={x(p.date)} cy={y(p.value)} r={5} fill={s.color} className="dot ring" />)}
            </g>
          );
        })}

        {labelsFit &&
          ends.map(({ s, p, ly }) => (
            <g key={s.id} transform={`translate(${x(p.date) + 10} ${ly})`}>
              <text className="end-value" dy="-0.1em">
                {format(p.value)}
              </text>
              <text className="end-name" dy="1.15em">
                {s.name.length > 18 ? s.name.slice(0, 17) + "…" : s.name}
              </text>
            </g>
          ))}
      </svg>

      {activeDate && ptr && tipRows.length > 0 && (
        <div
          className="tip glass"
          style={{
            left: Math.min(ptr.x + 14, (wrap.current?.clientWidth ?? width) - 210),
            top: Math.max(0, ptr.y - 20),
          }}
          role="status"
        >
          <div className="tip-date">{formatShortYear(activeDate)}</div>
          {tipRows.map(({ s, p }) => (
            <div key={s.id} className="tip-row">
              <span className="key" style={{ background: s.color }} />
              <strong className="num">{format(p.value)}</strong>
              <span>{s.name}</span>
              {p.note && <span className="muted">{p.note}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Sparkline({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return <span className="spark-empty muted small">{values.length ? "One workout" : ""}</span>;
  const w = 96;
  const h = 28;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pts = values.map((v, i) => [2 + (i / (values.length - 1)) * (w - 6), 3 + (1 - (v - lo) / (hi - lo || 1)) * (h - 6)]);
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className="spark">
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r={2.5} />
    </svg>
  );
}
