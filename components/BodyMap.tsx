"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";
import { FIGURES, type Region } from "@/lib/bodyMap";
import { MUSCLE_LABEL, type Muscle } from "@/lib/muscles";

type Props = {
  /** Accessible name for the whole map */
  label: string;
  /** Muscles drawn as chosen (outlined in ink) */
  selected?: ReadonlySet<Muscle>;
  /** 0–1 per muscle, drawn as chalk of increasing density */
  intensity?: Partial<Record<Muscle, number>>;
  /** Makes regions clickable */
  onToggle?: (m: Muscle) => void;
  /** Text under the figure when nothing is hovered */
  hint?: ReactNode;
  /** Extra text for a hovered muscle, e.g. "6 exercises" */
  describe?: (m: Muscle) => string | null;
  compact?: boolean;
};

const MIRROR = "matrix(-1 0 0 1 200 0)";
const GAP = 24;

/** Front and back figures with clickable muscle regions. */
export default function BodyMap({ label, selected, intensity, onToggle, hint, describe, compact }: Props) {
  const [hover, setHover] = useState<Muscle | null>(null);
  const interactive = !!onToggle;
  const focusable = new Set<Muscle>();

  const fill = (m: Muscle) => {
    const v = intensity?.[m] ?? 0;
    if (selected?.has(m) && !intensity) return "var(--coral)";
    if (v > 0) return `rgba(238, 93, 71, ${(0.18 + 0.82 * v).toFixed(3)})`;
    return hover === m ? "rgba(28,27,25,.2)" : "rgba(28,27,25,.1)";
  };

  const region = (r: Region, key: string) => {
    const isSel = !!selected?.has(r.muscle);
    const props = {
      d: r.d,
      fill: fill(r.muscle),
      stroke: isSel && intensity ? "var(--black)" : hover === r.muscle ? "var(--black)" : "rgba(255,255,255,.95)",
      strokeWidth: isSel && intensity ? 2 : hover === r.muscle ? 1.4 : 1,
      vectorEffect: "non-scaling-stroke" as const,
      className: "bm-region",
    };
    return (
      <g key={key}>
        <path {...props} />
        {r.mirror && <path {...props} transform={MIRROR} />}
      </g>
    );
  };

  const muscleGroup = (r: Region, i: number, figId: string) => {
    if (!interactive) return region(r, `${figId}-${i}`);
    const first = !focusable.has(r.muscle);
    focusable.add(r.muscle);
    const pressed = !!selected?.has(r.muscle);
    return (
      <g
        key={`${figId}-${i}`}
        role="button"
        tabIndex={first ? 0 : -1}
        aria-label={MUSCLE_LABEL[r.muscle]}
        aria-pressed={pressed}
        className="bm-hit"
        onClick={() => onToggle!(r.muscle)}
        onKeyDown={(e: KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle!(r.muscle);
          }
        }}
        onPointerEnter={() => setHover(r.muscle)}
        onPointerLeave={() => setHover((h) => (h === r.muscle ? null : h))}
        onFocus={() => setHover(r.muscle)}
        onBlur={() => setHover((h) => (h === r.muscle ? null : h))}
      >
        {region(r, "r")}
      </g>
    );
  };

  const extra = hover && describe ? describe(hover) : null;

  return (
    <figure className={`bodymap${compact ? " compact" : ""}`} aria-label={label} role="group">
      <svg viewBox={`0 0 ${400 + GAP} 424`} className="bm-svg">
        {FIGURES.map((f, fi) => (
          <g key={f.id} transform={`translate(${fi * (200 + GAP)} 0)`}>
            {f.shapes.map((d, i) => (
              <path key={`s${i}`} d={d} className="bm-base" />
            ))}
            {f.mirroredShapes.map((d, i) => (
              <g key={`m${i}`} className="bm-base">
                <path d={d} />
                <path d={d} transform={MIRROR} />
              </g>
            ))}
            {f.regions.map((r, i) => muscleGroup(r, i, f.id))}
            {f.lines.map((d, i) => (
              <path key={`l${i}`} d={d} className="bm-line" />
            ))}
            <text x={100} y={423} textAnchor="middle" className="bm-label">
              {f.label}
            </text>
          </g>
        ))}
      </svg>
      {!compact && (
        <figcaption className="bm-caption" aria-live="polite">
          {hover ? (
            <>
              <strong>{MUSCLE_LABEL[hover]}</strong>
              {extra ? <span>{extra}</span> : null}
            </>
          ) : (
            <span>{hint}</span>
          )}
        </figcaption>
      )}
    </figure>
  );
}
