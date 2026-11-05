"use client";

import { IconTimer } from "./Icons";

/** Rest choices offered everywhere, in seconds. */
export const REST_CHOICES = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 300, 360, 420, 480, 600];

/** 45 s, 1:30, 2:00 */
export const fmtRest = (sec: number) => (sec < 60 ? `${sec} s` : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`);

/**
 * A rest time chip. It shows the time that applies; underneath sits a native
 * <select>, so phones get their own picker. The first option goes back to
 * whatever this inherits (the workout's rest, or the account default).
 */
export default function RestSelect({
  value,
  inherited,
  inheritLabel,
  onChange,
  label,
  className = "",
}: {
  value: number | null | undefined;
  inherited: number;
  inheritLabel: string;
  onChange: (sec: number | null) => void;
  label: string;
  className?: string;
}) {
  const own = value != null;
  const shown = own ? value : inherited;
  const options = own && !REST_CHOICES.includes(value) ? [...REST_CHOICES, value].sort((a, b) => a - b) : REST_CHOICES;
  return (
    <span className={`rest-chip${own ? " own" : ""} ${className}`} title={own ? `${label}: set here` : `${label}: ${inheritLabel.toLowerCase()}`}>
      <IconTimer aria-hidden="true" />
      <span className="num">{fmtRest(shown)}</span>
      <span className="rest-word">rest</span>
      <select value={own ? String(value) : ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} aria-label={`${label}, now ${fmtRest(shown)}`}>
        <option value="">
          {inheritLabel} ({fmtRest(inherited)})
        </option>
        {options.map((s) => (
          <option key={s} value={s}>
            {fmtRest(s)}
          </option>
        ))}
      </select>
    </span>
  );
}
