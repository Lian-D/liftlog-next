"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Exercise } from "@/lib/exercises";
import { MUSCLE_LABEL, MUSCLES, type Muscle } from "@/lib/muscles";
import { muscleSets, normalise } from "@/lib/stats";
import type { Routine, RoutineItem } from "@/lib/types";
import { useApp } from "./AppContext";
import BodyMap from "./BodyMap";
import { ExerciseThumb } from "./ExerciseArt";
import ExercisePicker from "./ExercisePicker";
import { IconDown, IconTrash, IconUp } from "./Icons";
import Modal from "./Modal";
import PremadePrograms from "./Premade";
import RestSelect, { fmtRest } from "./RestSelect";

export default function RoutinesView() {
  const { data, editingRoutineId, editRoutine, setData, attempt } = useApp();
  const editing = data.routines.find((r) => r.id === editingRoutineId);
  const [view, setView] = useState<"mine" | "premade">(data.routines.length ? "mine" : "premade");

  const create = async () => {
    const r = await attempt(() => api.createRoutine("New routine"));
    if (r) {
      setData((d) => d && { ...d, routines: [...d.routines, r] });
      editRoutine(r.id);
    }
  };

  if (editing) return <RoutineEditor key={editing.id} routine={editing} onBack={() => editRoutine(null)} />;

  return (
    <div className="stack">
      <div className="page-head">
        <h1 className="title">Routines</h1>
        <button className="btn btn-chalk" onClick={create}>
          New routine
        </button>
      </div>
      <div className="seg routines-seg" role="tablist" aria-label="Which routines">
        {([["mine", `My routines${data.routines.length ? ` (${data.routines.length})` : ""}`], ["premade", "Premade"]] as const).map(([v, label]) => (
          <button key={v} role="tab" aria-selected={view === v} className={view === v ? "on" : ""} onClick={() => setView(v)}>
            {label}
          </button>
        ))}
      </div>
      {view === "premade" ? (
        <>
          <p className="muted">
            Ready-made routines to copy into yours. Adding one makes your own copy, so change its exercises, sets and rest however you like.
          </p>
          <PremadePrograms />
        </>
      ) : data.routines.length === 0 ? (
        <section className="glass panel empty-panel">
          <p>
            No routines yet. Create one, then tap muscles on the body map to fill it with exercises, or{" "}
            <button className="link-btn" onClick={() => setView("premade")}>
              pick a premade one
            </button>
            .
          </p>
        </section>
      ) : (
        <ul className="routine-list">
          {data.routines.map((r) => (
            <li key={r.id}>
              <button className="glass routine-line" onClick={() => editRoutine(r.id)}>
                <span className="subtitle">{r.name}</span>
                <span className="muted">
                  {r.items.length ? `${r.items.length} exercises, ${r.items.reduce((n, i) => n + i.sets, 0)} sets` : "Empty"}
                  {r.restSec ? `, ${fmtRest(r.restSec)} rest` : ""}
                </span>
                <span className="routine-line-go">Edit</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RoutineEditor({ routine, onBack }: { routine: Routine; onBack: () => void }) {
  const { data, catalog, setData, attempt, openGuide, notify } = useApp();
  const [name, setName] = useState(routine.name);
  const [items, setItems] = useState<RoutineItem[]>(routine.items);
  const [restSec, setRestSec] = useState<number | null>(routine.restSec);
  const [filter, setFilter] = useState<Set<Muscle>>(new Set());
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef<{ name: string; items: RoutineItem[]; restSec: number | null }>({ name, items, restSec });
  const dirty = useRef(false);

  const save = useCallback(async () => {
    window.clearTimeout(timer.current);
    if (!dirty.current) return;
    dirty.current = false;
    setSaveState("saving");
    try {
      const saved = await api.updateRoutine(routine.id, latest.current);
      setData((d) => d && { ...d, routines: d.routines.map((r) => (r.id === saved.id ? saved : r)) });
      if (!dirty.current) setSaveState("saved");
    } catch (e) {
      dirty.current = true;
      setSaveState("error");
      notify((e as Error).message);
    }
  }, [routine.id, setData, notify]);

  const change = (next: { name?: string; items?: RoutineItem[]; restSec?: number | null }) => {
    if (next.name !== undefined) setName(next.name);
    if (next.items !== undefined) setItems(next.items);
    if (next.restSec !== undefined) setRestSec(next.restSec);
    latest.current = { ...latest.current, ...next };
    dirty.current = true;
    setSaveState("saving");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(save, 500);
  };

  useEffect(() => () => void save(), [save]);

  const load = useMemo(() => muscleSets(items, catalog), [items, catalog]);
  const intensity = useMemo(() => normalise(load, 12), [load]);

  const toggleMuscle = (m: Muscle) => {
    const next = new Set(filter);
    if (next.has(m)) next.delete(m);
    else next.add(m);
    setFilter(next);
  };

  const add = (ex: Exercise) => change({ items: [...items, { exerciseId: ex.id, sets: ex.sets, reps: ex.reps }] });
  const patch = (i: number, p: Partial<RoutineItem>) => change({ items: items.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const setItemRest = (i: number, sec: number | null) =>
    change({
      items: items.map((x, j) => {
        if (j !== i) return x;
        const { restSec: _drop, ...rest } = x; // eslint-disable-line @typescript-eslint/no-unused-vars
        return sec == null ? rest : { ...rest, restSec: sec };
      }),
    });
  const routineRest = restSec ?? data.settings.restSec;
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const list = [...items];
    [list[i], list[j]] = [list[j], list[i]];
    change({ items: list });
  };
  const remove = (i: number) => change({ items: items.filter((_, j) => j !== i) });

  const del = async () => {
    window.clearTimeout(timer.current);
    dirty.current = false;
    const ok = await attempt(() => api.deleteRoutine(routine.id));
    if (ok) {
      setData((d) => d && { ...d, routines: d.routines.filter((r) => r.id !== routine.id) });
      notify(`Deleted ${name}.`);
      onBack();
    }
  };

  const totalSets = items.reduce((n, i) => n + i.sets, 0);
  const untouched = MUSCLES.filter((m) => !load[m.id]).map((m) => m.label.toLowerCase());

  return (
    <div className="stack">
      <div className="page-head">
        <div className="editor-title">
          <button className="link-btn back" onClick={onBack}>
            All routines
          </button>
          <input
            className="title title-input"
            value={name}
            maxLength={60}
            aria-label="Routine name"
            onChange={(e) => change({ name: e.target.value })}
          />
          <p className="muted logger-meta">
            <span>
              {items.length} exercises, {totalSets} sets
            </span>
            <RestSelect value={restSec} inherited={data.settings.restSec} inheritLabel="Your default" label="Rest between sets in this routine" onChange={(v) => change({ restSec: v })} />
            <span className={`save-state ${saveState}`}>{saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving" : "Not saved"}</span>
          </p>
        </div>
        <button className="btn btn-ghost" onClick={() => setConfirmDelete(true)}>
          Delete routine
        </button>
      </div>

      <div className="editor">
        <aside className="glass panel editor-map">
          <BodyMap
            label="Routine coverage. Select muscles to find exercises."
            intensity={intensity}
            selected={filter}
            onToggle={toggleMuscle}
            describe={(m) => {
              const n = load[m] ?? 0;
              const sets = n ? `${Number.isInteger(n) ? n : n.toFixed(1)} sets in this routine` : "Not in this routine yet";
              return filter.has(m) ? `${sets}. Showing its exercises.` : `${sets}. Tap to see exercises.`;
            }}
            hint="Brighter means more sets. Tap a muscle to list its exercises."
          />
          {items.length > 0 && untouched.length > 0 && untouched.length < MUSCLES.length && (
            <p className="muted small map-note">Not trained here: {untouched.join(", ")}.</p>
          )}
        </aside>

        <div className="stack">
          <section className="glass panel" aria-labelledby="in-routine">
            <h2 id="in-routine" className="subtitle">In this routine</h2>
            {items.length === 0 ? (
              <p className="muted">Pick muscles on the body map, then add exercises from the list below.</p>
            ) : (
              <ol className="items">
                {items.map((it, i) => {
                  const ex = catalog.get(it.exerciseId);
                  const timed = ex.measure === "time";
                  return (
                    <li key={it.exerciseId} className="item swap-host">
                      <button className="thumb-btn" onClick={() => openGuide(ex.id)} aria-label={`How to do ${ex.name}`}>
                        <ExerciseThumb ex={ex} size={48} swap />
                      </button>
                      <div className="item-text">
                        <button className="link-btn" onClick={() => openGuide(ex.id)}>
                          {ex.name}
                        </button>
                        <span className="muted small item-sub">
                          <span>{ex.primary.map((m) => MUSCLE_LABEL[m]).join(", ")}</span>
                          {ex.measure !== "cardio" && (
                            <RestSelect value={it.restSec} inherited={routineRest} inheritLabel="Routine's rest" label={`Rest after each ${ex.name} set`} onChange={(v) => setItemRest(i, v)} />
                          )}
                        </span>
                      </div>
                      <Stepper label={ex.measure === "cardio" ? "Bouts" : "Sets"} value={it.sets} min={1} max={20} onChange={(v) => patch(i, { sets: v })} />
                      <span className="times" aria-hidden="true">×</span>
                      {ex.measure === "cardio" ? (
                        <Stepper label="Minutes" value={Math.max(1, Math.round(it.reps / 60))} min={1} max={180} onChange={(v) => patch(i, { reps: v * 60 })} />
                      ) : (
                        <Stepper label={timed ? "Seconds" : "Reps"} value={it.reps} min={1} max={timed ? 600 : 100} step={timed ? 5 : 1} onChange={(v) => patch(i, { reps: v })} />
                      )}
                      <div className="item-actions">
                        <button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${ex.name} up`}>
                          <IconUp />
                        </button>
                        <button className="icon-btn" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`Move ${ex.name} down`}>
                          <IconDown />
                        </button>
                        <button className="icon-btn" onClick={() => remove(i)} aria-label={`Remove ${ex.name}`}>
                          <IconTrash />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <section className="glass panel" aria-labelledby="add-ex">
            <h2 id="add-ex" className="subtitle">Add exercises</h2>
            <ExercisePicker
              onPick={add}
              isAdded={(id) => items.some((x) => x.exerciseId === id)}
              muscles={filter}
              onMusclesChange={setFilter}
            />
          </section>
        </div>
      </div>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${name}?`}
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
              Keep it
            </button>
            <button className="btn btn-danger" onClick={del}>
              Delete routine
            </button>
          </>
        }
      >
        <p>The routine goes away. Workouts you already logged with it stay in your history.</p>
      </Modal>
    </div>
  );
}

function Stepper({
  label, value, min, max, step = 1, onChange,
}: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button onClick={() => onChange(clamp(value - step))} disabled={value <= min} aria-label={`Fewer ${label.toLowerCase()}`}>
        −
      </button>
      <input
        className="num"
        inputMode="numeric"
        value={value}
        aria-label={label}
        onChange={(e) => {
          const v = Number(e.target.value.replace(/\D/g, ""));
          if (v) onChange(clamp(v));
        }}
        onFocus={(e) => e.target.select()}
      />
      <button onClick={() => onChange(clamp(value + step))} disabled={value >= max} aria-label={`More ${label.toLowerCase()}`}>
        +
      </button>
      <span className="stepper-label">{label}</span>
    </div>
  );
}
