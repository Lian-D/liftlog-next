"use client";

import { useState } from "react";
import type { Exercise } from "@/lib/exercises";
import { imageFor } from "@/lib/exercises";

/**
 * Line drawing of an exercise. Shows the stretched position and switches to the
 * contracted one on hover or focus of the surrounding card (`.swap-host`).
 */
export function ExerciseThumb({ ex, size = 56, swap = false }: { ex: Exercise; size?: number; swap?: boolean }) {
  const a = imageFor(ex, "a");
  const b = imageFor(ex, "b");
  const [broken, setBroken] = useState(false);
  if (ex.measure === "cardio")
    return (
      <span className="thumb thumb-text thumb-cardio" style={{ width: size, height: size }} aria-hidden="true">
        <svg viewBox="0 0 24 24" width={size * 0.5} height={size * 0.5} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 12.5h4l2.2-5.5 4.3 11 2.4-6.2 1.3 0.7h4.8" />
        </svg>
      </span>
    );
  if (!a || !b || broken) {
    const initials = ex.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
    return (
      <span className="thumb thumb-text" style={{ width: size, height: size }} aria-hidden="true">
        {initials}
      </span>
    );
  }
  return (
    <span className={`thumb${swap ? " thumb-swap" : ""}`} style={{ width: size, height: size }} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={a} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />
      {swap && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={b} alt="" loading="lazy" decoding="async" className="thumb-b" />
      )}
    </span>
  );
}

/** The two positions side by side, for the guide. */
export function ExerciseFrames({ ex }: { ex: Exercise }) {
  const a = imageFor(ex, "a");
  const b = imageFor(ex, "b");
  if (!a || !b) return null;
  return (
    <div className="frames">
      <figure>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={a} alt={`${ex.name}, stretched position`} />
        <figcaption>Stretched</figcaption>
      </figure>
      <figure>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={b} alt={`${ex.name}, contracted position`} />
        <figcaption>Contracted</figcaption>
      </figure>
    </div>
  );
}
