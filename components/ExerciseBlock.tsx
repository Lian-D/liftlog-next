"use client";

import { Fragment, useLayoutEffect, useRef, useState } from "react";
import type { CardioField, Exercise } from "@/lib/exercises";
import type { DistUnit, Machine, SessionExercise, SetEntry, SetExtra, Unit } from "@/lib/types";
import { fmtClockSec, fmtWeight, fromDist, parseDuration, parseWeight, toDist, toUnit } from "@/lib/units";
import { ExerciseThumb } from "./ExerciseArt";
import { IconCheck, IconMore, IconNote, IconPlus, IconStack } from "./Icons";
import RestSelect from "./RestSelect";
import SetupNote from "./SetupNote";

export type Prev = { reps: number; weightKg: number; note?: string; x?: SetExtra };

const r2 = (v: number) => Math.round(v * 100) / 100;

/** The columns a cardio machine logs besides time. Distance is stored in km and shown in km or mi. */
const CARDIO: Record<CardioField, { head: (d: DistUnit) => string; label: (d: DistUnit) => string; read: (x: SetExtra | undefined, d: DistUnit) => number | undefined; write: (v: number | undefined, d: DistUnit) => SetExtra }> = {
  km: { head: (d) => d, label: (d) => (d === "km" ? "kilometres" : "miles"), read: (x, d) => (x?.km != null ? r2(toDist(x.km, d)) : undefined), write: (v, d) => ({ km: v == null ? undefined : fromDist(v, d) }) },
  m: { head: () => "Metres", label: () => "metres", read: (x) => x?.m, write: (v) => ({ m: v == null ? undefined : Math.round(v) }) },
  incline: { head: () => "Incline %", label: () => "incline percent", read: (x) => x?.incline, write: (v) => ({ incline: v }) },
  level: { head: () => "Level", label: () => "level", read: (x) => x?.level, write: (v) => ({ level: v }) },
  floors: { head: () => "Floors", label: () => "floors", read: (x) => x?.floors, write: (v) => ({ floors: v == null ? undefined : Math.round(v) }) },
};

/** "20:00 · 2.5 km · 4%" for a cardio bout */
export function cardioText(ex: Exercise, s: { reps: number | null; x?: SetExtra }, d: DistUnit) {
  const bits = [s.reps ? fmtClockSec(s.reps) : ""];
  for (const f of ex.cardio ?? []) {
    const v = CARDIO[f].read(s.x, d);
    if (v == null) continue;
    bits.push(f === "km" ? `${v} ${d}` : f === "m" ? `${v} m` : f === "incline" ? `${v}% incline` : f === "level" ? `level ${v}` : `${v} floors`);
  }
  if (s.x?.cal) bits.push(`${s.x.cal} kcal`);
  if (s.x?.hr) bits.push(`${s.x.hr} bpm`);
  return bits.filter(Boolean).join(" · ");
}

export const isMachineEquipment = (ex: Exercise) => /machine|cable/i.test(ex.equipment) && ex.measure === "weight";
export const stickerFactor = (m: Machine) => m.realKg / m.sticker;

export default function ExerciseBlock(p: {
  e: SessionExercise;
  ei: number;
  ex: Exercise;
  unit: Unit;
  distUnit: DistUnit;
  count: number;
  prev: Prev[];
  workoutRest: number;
  showRest: boolean;
  onRest: (sec: number | null) => void;
  machine: Machine | null;
  machines: Machine[];
  onMachine: (id: string | null | "manage") => void;
  noteOpen: { si: number; focus: boolean } | null;
  onOpenNote: (si: number) => void;
  onCloseNote: () => void;
  suggestedKg: (si: number) => number | null;
  suggestedSticker: (si: number) => number | null;
  onSet: (si: number, patch: Partial<SetEntry>) => void;
  onToggle: (si: number) => void;
  onAddSet: () => void;
  onRemoveLastSet: () => void;
  onMove: (d: -1 | 1) => void;
  onRemove: () => void;
  onGuide: () => void;
}) {
  const { e, ei, ex, unit, distUnit, machine } = p;
  const timed = ex.measure === "time";
  const cardio = ex.measure === "cardio";
  const sticker = !!machine && ex.measure === "weight";
  const factor = machine ? stickerFactor(machine) : 1;
  const fields = ex.cardio ?? [];
  const weightHead = sticker ? "Sticker" : ex.measure === "bodyweight" ? `+${unit}` : unit;
  const done = e.sets.filter((x) => x.done).length;
  const [setupEditing, setSetupEditing] = useState(false);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const act = (fn: () => void) => () => {
    fn();
    menuRef.current?.removeAttribute("open");
  };
  const showMachine = ex.measure === "weight" && (isMachineEquipment(ex) || !!machine);
  const what = cardio ? (e.sets.length === 1 ? "bout" : "bouts") : e.sets.length === 1 ? "set" : "sets";

  const prevText = (si: number) => {
    const ref = p.prev[si];
    if (!ref) return "–";
    if (timed) return `${ref.reps} s`;
    if (ex.measure === "bodyweight" && !ref.weightKg) return `${ref.reps} reps`;
    if (sticker && ref.x?.sticker != null) return `#${ref.x.sticker} × ${ref.reps}`;
    return `${fmtWeight(ref.weightKg, unit)} × ${ref.reps}`;
  };

  /** For cardio placeholders: the bout above, else the same bout last time */
  const cardioHint = (si: number) => (si > 0 ? e.sets[si - 1] : undefined) ?? (p.prev[si] ? { reps: p.prev[si].reps, x: p.prev[si].x } : undefined);

  return (
    <section className="glass panel ex-block" aria-labelledby={`ex-${ei}`}>
      <header className="ex-head">
        <button className="thumb-btn" onClick={p.onGuide} aria-label={`How to do ${ex.name}`}>
          <ExerciseThumb ex={ex} size={48} />
        </button>
        <div className="ex-title">
          <h2 id={`ex-${ei}`}>
            <button className="link-btn" onClick={p.onGuide}>
              {ex.name}
            </button>
          </h2>
          <p className="muted small ex-sub">
            <span>
              {done} of {e.sets.length} {what} done
            </span>
            {p.showRest && !cardio && (
              <RestSelect value={e.restSec} inherited={p.workoutRest} inheritLabel="Workout's rest" label={`Rest after each ${ex.name} set`} onChange={p.onRest} />
            )}
            {showMachine && <MachineChip ex={ex} unit={unit} machine={machine} machines={p.machines} onChange={p.onMachine} />}
          </p>
        </div>
        <button
          className={`icon-btn note-btn${setupEditing ? " on" : ""}`}
          onClick={() => setSetupEditing((v) => !v)}
          aria-label={`Setup note for ${ex.name}`}
          aria-pressed={setupEditing}
          title="Setup note"
        >
          <IconNote />
        </button>
        <details className="menu" ref={menuRef}>
          <summary className="icon-btn" aria-label={`Options for ${ex.name}`}>
            <IconMore />
          </summary>
          <div className="menu-pop glass">
            <button onClick={act(p.onGuide)}>How to do it</button>
            <button onClick={act(() => setSetupEditing(true))}>Setup note</button>
            {ex.measure === "weight" && !showMachine && <button onClick={act(() => p.onMachine("manage"))}>Use machine stickers</button>}
            <button onClick={act(p.onRemoveLastSet)} disabled={!e.sets.length}>
              Remove last {cardio ? "bout" : "set"}
            </button>
            <button onClick={act(() => p.onMove(-1))} disabled={ei === 0}>
              Move up
            </button>
            <button onClick={act(() => p.onMove(1))} disabled={ei === p.count - 1}>
              Move down
            </button>
            <button className="danger" onClick={act(p.onRemove)}>
              Remove exercise
            </button>
          </div>
        </details>
      </header>

      <SetupNote exerciseId={ex.id} name={ex.name} editing={setupEditing} setEditing={setSetupEditing} />

      <div
        className={`sets${timed ? " timed" : ""}${cardio ? ` cardio f${fields.length}` : ""}`}
        role="table"
        aria-label={`${ex.name} ${what}`}
      >
        <div className="set-row set-head" role="row">
          <span role="columnheader">{cardio ? "#" : "Set"}</span>
          {cardio ? (
            <>
              <span role="columnheader">Time</span>
              {fields.map((f) => (
                <span key={f} role="columnheader">
                  {CARDIO[f].head(distUnit)}
                </span>
              ))}
            </>
          ) : (
            <>
              <span role="columnheader">Last time</span>
              {!timed && <span role="columnheader">{weightHead}</span>}
              <span role="columnheader">{timed ? "Sec" : "Reps"}</span>
            </>
          )}
          <span role="columnheader" className="sr-only">
            Done
          </span>
        </div>
        {e.sets.map((set, si) => {
          const lastNote = p.prev[si]?.note;
          const showNote = set.note != null || p.noteOpen?.si === si;
          const hint = cardio ? cardioHint(si) : undefined;
          const sugg = cardio ? null : sticker ? p.suggestedSticker(si) : p.suggestedKg(si);
          return (
            <Fragment key={si}>
              <div className={`set-row${set.done ? " done" : ""}${showNote ? " with-note" : ""}`} role="row">
                <span role="cell">
                  <button
                    className={`set-n num${set.note ? " has-note" : ""}`}
                    onClick={() => (p.noteOpen?.si === si && !set.note ? p.onCloseNote() : p.onOpenNote(si))}
                    aria-label={`${cardio ? "Bout" : "Set"} ${si + 1}. ${set.note ? `Note: ${set.note}` : cardio ? "Add calories, heart rate or a note" : "Add a note"}`}
                    aria-expanded={showNote}
                  >
                    {si + 1}
                  </button>
                </span>
                {cardio ? (
                  <>
                    <span role="cell">
                      <DurationInput
                        sec={set.reps}
                        placeholder={hint?.reps ? fmtClockSec(hint.reps) : fmtClockSec(ex.reps)}
                        label={`Bout ${si + 1} time, minutes and seconds`}
                        maxSec={MAX_BOUT_SEC}
                        onChange={(sec) => p.onSet(si, { reps: sec })}
                      />
                    </span>
                    {fields.map((f) => (
                      <span role="cell" key={f}>
                        <NumInput
                          value={CARDIO[f].read(set.x, distUnit)}
                          placeholder={hint ? String(CARDIO[f].read(hint.x, distUnit) ?? "") : ""}
                          label={`Bout ${si + 1} ${CARDIO[f].label(distUnit)}`}
                          onChange={(v) => p.onSet(si, { x: { ...set.x, ...CARDIO[f].write(v, distUnit) } })}
                        />
                      </span>
                    ))}
                  </>
                ) : (
                  <>
                    <span className="set-prev num" role="cell" title={lastNote ? `Last time: ${lastNote}` : undefined}>
                      {prevText(si)}
                      {lastNote && <IconNote className="prev-note" aria-label="has a note" />}
                    </span>
                    {!timed && (
                      <span role="cell" className={sticker ? "sticker-cell" : undefined}>
                        {sticker ? (
                          <>
                            <NumInput
                              id={`w-${ei}-${si}`}
                              value={set.x?.sticker}
                              placeholder={sugg != null ? String(sugg) : ""}
                              label={`Set ${si + 1} sticker number on ${machine!.name}`}
                              onChange={(v) => p.onSet(si, { x: { ...set.x, sticker: v }, weightKg: v == null ? null : v * factor })}
                            />
                            <span className="sticker-real num" aria-hidden="true">
                              {(() => {
                                const st = set.x?.sticker ?? sugg;
                                return st != null ? `${fmtWeight(st * factor, unit)} ${unit}` : "";
                              })()}
                            </span>
                          </>
                        ) : (
                          <WeightInput
                            id={`w-${ei}-${si}`}
                            kg={set.weightKg}
                            unit={unit}
                            placeholder={sugg != null ? fmtWeight(sugg, unit) : ex.measure === "bodyweight" ? "0" : ""}
                            label={`Set ${si + 1} ${ex.measure === "bodyweight" ? "added weight" : "weight"} in ${unit}`}
                            onChange={(kg) => p.onSet(si, { weightKg: kg })}
                          />
                        )}
                      </span>
                    )}
                    <span role="cell">
                      <input
                        className="num-input"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={set.reps ?? ""}
                        placeholder={String(ex.reps)}
                        aria-label={`Set ${si + 1} ${timed ? "seconds" : "reps"}`}
                        onChange={(ev) => {
                          const v = ev.target.value.replace(/\D/g, "").slice(0, 4);
                          p.onSet(si, { reps: v === "" ? null : Number(v) });
                        }}
                        onFocus={(ev) => ev.target.select()}
                      />
                    </span>
                  </>
                )}
                <span role="cell">
                  <button className={`check${set.done ? " on" : ""}`} aria-pressed={set.done} aria-label={`${cardio ? "Bout" : "Set"} ${si + 1} done`} onClick={() => p.onToggle(si)}>
                    <IconCheck />
                  </button>
                </span>
              </div>
              {showNote && (
                <div className={`set-note${cardio ? " with-extras" : ""}`} role="row">
                  <span role="cell">
                    {cardio && (
                      <>
                        <label className="mini-field">
                          <NumInput
                            className="mini"
                            value={set.x?.cal}
                            placeholder="–"
                            label={`Bout ${si + 1} calories`}
                            onChange={(v) => p.onSet(si, { x: { ...set.x, cal: v == null ? undefined : Math.round(v) } })}
                          />
                          <small>kcal</small>
                        </label>
                        <label className="mini-field">
                          <NumInput
                            className="mini"
                            value={set.x?.hr}
                            placeholder="–"
                            label={`Bout ${si + 1} average heart rate`}
                            onChange={(v) => p.onSet(si, { x: { ...set.x, hr: v == null ? undefined : Math.round(v) } })}
                          />
                          <small>bpm</small>
                        </label>
                      </>
                    )}
                    <span className="set-note-text">
                      <IconNote aria-hidden="true" />
                      <NoteInput
                        value={set.note ?? ""}
                        autoFocus={p.noteOpen?.si === si && p.noteOpen.focus && !cardio}
                        placeholder={lastNote ? `Last time: ${lastNote}` : set.done ? (cardio ? "Note" : "How was that set?") : "Note for this set"}
                        label={`Note for ${cardio ? "bout" : "set"} ${si + 1} of ${ex.name}`}
                        onChange={(v) => p.onSet(si, { note: v || undefined })}
                        onDone={() => !set.note && p.onCloseNote()}
                      />
                    </span>
                  </span>
                  {lastNote && set.note && <span className="set-note-prev">Last time: {lastNote}</span>}
                </div>
              )}
            </Fragment>
          );
        })}
      </div>
      <button className="btn btn-ghost add-set" onClick={p.onAddSet}>
        <IconPlus /> Add {cardio ? "bout" : "set"}
      </button>
    </section>
  );
}

function MachineChip({
  ex, unit, machine, machines, onChange,
}: { ex: Exercise; unit: Unit; machine: Machine | null; machines: Machine[]; onChange: (id: string | null | "manage") => void }) {
  return (
    <span className={`rest-chip machine-chip${machine ? " own" : ""}`} title={machine ? `${machine.name}: stack numbers converted to ${unit}` : "Logging real weights"}>
      <IconStack aria-hidden="true" />
      <span className="machine-name">{machine ? machine.name : `Real ${unit}`}</span>
      <select
        value={machine?.id ?? ""}
        aria-label={`Weights for ${ex.name}: ${machine ? `${machine.name} stickers` : `real ${unit}`}`}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value === "__manage" ? "manage" : e.target.value)}
      >
        <option value="">Real weights ({unit})</option>
        {machines.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}: 1 on the stack = {r2(toUnit(stickerFactor(m), unit))} {unit}
          </option>
        ))}
        <option value="__manage">Add or edit machines…</option>
      </select>
    </span>
  );
}

/** Keeps the typed text while editing, so "62." or "62,5" don't get rewritten mid-keystroke. */
function WeightInput({
  id, kg, unit, placeholder, label, onChange,
}: { id: string; kg: number | null; unit: Unit; placeholder: string; label: string; onChange: (kg: number | null) => void }) {
  const [text, setText] = useState(() => fmtWeight(kg, unit));
  const [focused, setFocused] = useState(false);
  const shown = focused ? text : fmtWeight(kg, unit);
  const bad = focused && parseWeight(text, unit) === "invalid";

  return (
    <input
      id={id}
      className={`num-input${bad ? " bad" : ""}`}
      inputMode="decimal"
      value={shown}
      placeholder={placeholder}
      aria-label={label}
      aria-invalid={bad || undefined}
      onFocus={(ev) => {
        setText(fmtWeight(kg, unit));
        setFocused(true);
        requestAnimationFrame(() => ev.target.select());
      }}
      onBlur={() => setFocused(false)}
      onChange={(ev) => {
        const t = ev.target.value.replace(/[^\d.,]/g, "").slice(0, 7);
        setText(t);
        const v = parseWeight(t, unit);
        if (v !== "invalid") onChange(v);
      }}
    />
  );
}

/**
 * A set note that wraps onto more lines as it grows, instead of scrolling sideways in a
 * one-line box. Enter (or the keyboard's Done) still closes it; notes are single-line text.
 */
function NoteInput({
  value, placeholder, label, autoFocus, onChange, onDone,
}: { value: string; placeholder: string; label: string; autoFocus: boolean; onChange: (v: string) => void; onDone: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // Fit the height to the text (and to a long placeholder when empty). field-sizing in CSS
  // does this where supported; this covers older Safari.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value, placeholder]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      maxLength={200}
      autoFocus={autoFocus}
      placeholder={placeholder}
      aria-label={label}
      enterKeyHint="done"
      onChange={(ev) => onChange(ev.target.value.replace(/\s*\n\s*/g, " "))}
      onKeyDown={(ev) => {
        if (ev.key === "Enter" || ev.key === "Escape") {
          ev.preventDefault();
          ev.currentTarget.blur();
          onDone();
        }
      }}
    />
  );
}

/** A plain decimal number; empty means not given. */
export function NumInput({
  id, value, placeholder, label, onChange, className = "",
}: { id?: string; value: number | undefined | null; placeholder: string; label: string; onChange: (v: number | undefined) => void; className?: string }) {
  const [text, setText] = useState(value == null ? "" : String(value));
  const [focused, setFocused] = useState(false);
  const shown = focused ? text : value == null ? "" : String(value);
  return (
    <input
      id={id}
      className={`num-input ${className}`}
      inputMode="decimal"
      value={shown}
      placeholder={placeholder}
      aria-label={label}
      onFocus={(ev) => {
        setText(value == null ? "" : String(value));
        setFocused(true);
        requestAnimationFrame(() => ev.target.select());
      }}
      onBlur={() => setFocused(false)}
      onChange={(ev) => {
        const t = ev.target.value.replace(/[^\d.,-]/g, "").slice(0, 8);
        setText(t);
        if (!t.trim()) return onChange(undefined);
        const v = Number(t.replace(",", "."));
        if (Number.isFinite(v)) onChange(v);
      }}
    />
  );
}

/** Minutes and seconds: "25:30", or "25" for 25 minutes. */
export function DurationInput({
  sec, placeholder, label, onChange, id, maxSec,
}: { sec: number | null; placeholder: string; label: string; onChange: (sec: number | null) => void; id?: string; maxSec?: number }) {
  const [text, setText] = useState(sec ? fmtClockSec(sec) : "");
  const [focused, setFocused] = useState(false);
  const shown = focused ? text : sec ? fmtClockSec(sec) : "";
  const parse = (t: string) => {
    const v = parseDuration(t);
    return typeof v === "number" && maxSec != null && v > maxSec ? "invalid" : v;
  };
  const bad = focused && parse(text) === "invalid";
  return (
    <input
      id={id}
      className={`num-input${bad ? " bad" : ""}`}
      inputMode="text"
      value={shown}
      placeholder={placeholder}
      aria-label={label}
      aria-invalid={bad || undefined}
      onFocus={(ev) => {
        setText(sec ? fmtClockSec(sec) : "");
        setFocused(true);
        requestAnimationFrame(() => ev.target.select());
      }}
      onBlur={() => setFocused(false)}
      onChange={(ev) => {
        const t = ev.target.value.replace(/[^\d:.m ]/gi, "").slice(0, 8);
        setText(t);
        const v = parse(t);
        if (v !== "invalid") onChange(v);
      }}
    />
  );
}

/** A cardio bout is at most 3 hours, the same limit the server checks */
const MAX_BOUT_SEC = 3 * 3600;
