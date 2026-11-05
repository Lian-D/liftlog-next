"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Exercise } from "@/lib/exercises";
import { pacificDate, pacificTime, pacificToEpoch } from "@/lib/time";
import { bestE1rm, e1rm, previousSets, sessionTotals } from "@/lib/stats";
import { formatDuration } from "@/lib/time";
import type { Machine, Routine, RoutineItem, Session, SessionExercise, SetEntry } from "@/lib/types";
import { useApp } from "./AppContext";
import ExerciseBlock, { stickerFactor, type Prev } from "./ExerciseBlock";
import ExercisePicker from "./ExercisePicker";
import { IconPlus } from "./Icons";
import MachinesDialog from "./Machines";
import Modal from "./Modal";
import RestSelect, { fmtRest } from "./RestSelect";
import { useTimer } from "./Timer";

export type FinishSummary = { name: string; sets: number; volumeKg: number; durationMs: number; prs: { name: string; kg: number }[] };

type SaveState = "saved" | "saving" | "error";

export default function Logger({ initial, onFinished }: { initial: Session; onFinished: (s: FinishSummary) => void }) {
  const { data, setData, reload, unit, catalog, attempt, notify, openGuide } = useApp();
  const restTimer = useTimer();
  const [s, setS] = useState(initial);
  const sRef = useRef(initial);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const pending = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  /** The set whose note line is open: "exerciseId:setIndex". focus is true when it was opened on purpose. */
  const [noteOpen, setNoteOpen] = useState<{ key: string; focus: boolean } | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState<null | "finish" | "discard">(null);
  const [busy, setBusy] = useState(false);
  const [machinesFor, setMachinesFor] = useState<{ exerciseId: string; name: string } | null>(null);
  const past = s.pastMin != null;

  // ---------- autosave ----------
  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    if (!pending.current) return true;
    pending.current = false;
    const cur = sRef.current;
    setSaveState("saving");
    try {
      await api.saveSession(cur.id, {
        name: cur.name,
        notes: cur.notes,
        restSec: cur.restSec,
        exercises: cur.exercises,
        ...(cur.pastMin != null ? { pastMin: cur.pastMin, startedAt: cur.startedAt } : {}),
      });
      if (!pending.current) setSaveState("saved");
      return true;
    } catch {
      pending.current = true;
      setSaveState("error");
      timer.current = window.setTimeout(flush, 5000);
      return false;
    }
  }, []);

  const update = useCallback(
    (fn: (cur: Session) => Session) => {
      const next = fn(sRef.current);
      sRef.current = next;
      setS(next);
      pending.current = true;
      setSaveState("saving");
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, 600);
    },
    [flush]
  );

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();
      // Leaving the Train tab unmounts the logger. Hand the live workout back to app state,
      // or coming back would remount from the stale copy loaded at startup and the next
      // autosave would overwrite everything logged since.
      const cur = sRef.current;
      setData((d) => (d && d.activeSession?.id === cur.id ? { ...d, activeSession: cur } : d));
    };
  }, [flush, setData]);

  // ---------- previous workout, for placeholders ----------
  const prev = useMemo(() => {
    const m: Record<string, Prev[]> = {};
    for (const e of s.exercises) m[e.exerciseId] ??= previousSets(data.history, e.exerciseId);
    return m;
  }, [s.exercises, data.history]);

  /** Weight to suggest for a set: the set above it in this workout, else the same set last time. */
  const suggestedKg = (e: SessionExercise, si: number): number | null => {
    for (let i = si - 1; i >= 0; i--) if (e.sets[i].weightKg != null) return e.sets[i].weightKg;
    const p = prev[e.exerciseId];
    const ref = p?.[si] ?? p?.[p.length - 1];
    return ref && ref.weightKg > 0 ? ref.weightKg : null;
  };

  /** Same idea for machine stickers: the set above, else the same set last time. */
  const suggestedSticker = (e: SessionExercise, si: number): number | null => {
    for (let i = si - 1; i >= 0; i--) if (e.sets[i].x?.sticker != null) return e.sets[i].x!.sticker!;
    const p = prev[e.exerciseId];
    return p?.[si]?.x?.sticker ?? p?.findLast((x) => x.x?.sticker != null)?.x?.sticker ?? null;
  };

  const machineFor = (exerciseId: string): Machine | null => {
    const id = data.exercisePrefs[exerciseId]?.machineId;
    return (id && data.machines.find((m) => m.id === id)) || null;
  };

  const chooseMachine = (exerciseId: string, id: string | null | "manage") => {
    if (id === "manage") return setMachinesFor({ exerciseId, name: catalog.get(exerciseId).name });
    setData((d) => {
      if (!d) return d;
      const cur = d.exercisePrefs[exerciseId] ?? { note: "", machineId: null };
      return { ...d, exercisePrefs: { ...d.exercisePrefs, [exerciseId]: { ...cur, machineId: id } } };
    });
    void attempt(() => api.saveExercisePref(exerciseId, { machineId: id }));
  };

  // ---------- edits ----------
  const setExercise = (ei: number, fn: (e: SessionExercise) => SessionExercise) =>
    update((cur) => ({ ...cur, exercises: cur.exercises.map((e, i) => (i === ei ? fn(e) : e)) }));

  const setSet = (ei: number, si: number, patch: Partial<SetEntry>) =>
    setExercise(ei, (e) => ({ ...e, sets: e.sets.map((x, i) => (i === si ? { ...x, ...patch } : x)) }));

  const toggleDone = (ei: number, si: number) => {
    const e = sRef.current.exercises[ei];
    const set = e.sets[si];
    const ex = catalog.get(e.exerciseId);
    if (set.done) return setSet(ei, si, { done: false });

    if (ex.measure === "cardio") {
      const reps = set.reps && set.reps > 0 ? set.reps : (si > 0 ? e.sets[si - 1].reps : null) ?? prev[e.exerciseId]?.[si]?.reps ?? ex.reps;
      setSet(ei, si, { done: true, weightKg: 0, reps });
      setNoteOpen({ key: `${e.exerciseId}:${si}`, focus: false });
      return; // no rest timer after a cardio bout
    }

    const machine = ex.measure === "weight" ? machineFor(e.exerciseId) : null;
    if (machine) {
      const sticker = set.x?.sticker ?? suggestedSticker(e, si);
      if (sticker == null) {
        notify(`Enter the sticker number for set ${si + 1} of ${ex.name}.`);
        document.getElementById(`w-${ei}-${si}`)?.focus();
        return;
      }
      const reps = set.reps && set.reps > 0 ? set.reps : prev[e.exerciseId]?.[si]?.reps ?? ex.reps;
      setSet(ei, si, { done: true, reps, weightKg: sticker * stickerFactor(machine), x: { ...set.x, sticker } });
      setNoteOpen({ key: `${e.exerciseId}:${si}`, focus: false });
      if (data.settings.restAuto && !past) restTimer.start(restFor(e), { kind: "rest", label: nextUp(ei, si) });
      return;
    }

    let weightKg = set.weightKg;
    if (weightKg == null && ex.measure === "weight") weightKg = suggestedKg(e, si);
    if (weightKg == null && ex.measure !== "weight") weightKg = 0;
    if (weightKg == null) {
      notify(`Enter the weight for set ${si + 1} of ${ex.name}.`);
      document.getElementById(`w-${ei}-${si}`)?.focus();
      return;
    }
    const reps = set.reps && set.reps > 0 ? set.reps : prev[e.exerciseId]?.[si]?.reps ?? ex.reps;
    setSet(ei, si, { done: true, weightKg, reps });
    // A note line opens under the set, ready for "felt easy" while it's fresh
    setNoteOpen({ key: `${e.exerciseId}:${si}`, focus: false });
    if (data.settings.restAuto && !past) restTimer.start(restFor(e), { kind: "rest", label: nextUp(ei, si) });
  };

  // ---------- rest between sets: exercise, then workout (routine), then account default ----------
  const workoutRest = s.restSec ?? data.settings.restSec;
  const restFor = (e: SessionExercise) => e.restSec ?? sRef.current.restSec ?? data.settings.restSec;

  /** What the rest alert should say comes next, worked out as if set si of exercise ei is now done. */
  const nextUp = (ei: number, si: number) => {
    const list = sRef.current.exercises;
    const open = (x: SessionExercise, i: number) => x.sets.findIndex((st, j) => !st.done && !(i === ei && j === si));
    const here = open(list[ei], ei);
    if (here >= 0) return `Next: ${catalog.get(list[ei].exerciseId).name}, set ${here + 1}`;
    for (let k = 1; k < list.length; k++) {
      const i = (ei + k) % list.length;
      const j = open(list[i], i);
      if (j >= 0) return `Next: ${catalog.get(list[i].exerciseId).name}, set ${j + 1}`;
    }
    return "That was the last set. Finish when you're ready.";
  };

  /** Keep a rest change in the routine this workout came from, so next time starts with it. */
  const rememberInRoutine = (make: (r: Routine) => { restSec?: number | null; items?: RoutineItem[] }, what: string) => {
    const r = data.routines.find((x) => x.id === sRef.current.routineId);
    if (!r) return notify(`${what}.`);
    void attempt(() => api.updateRoutine(r.id, make(r))).then((saved) => {
      if (!saved) return;
      setData((d) => d && { ...d, routines: d.routines.map((x) => (x.id === saved.id ? saved : x)) });
      notify(`${what}. Saved to ${r.name} for next time.`);
    });
  };

  const setWorkoutRest = (sec: number | null) => {
    update((cur) => ({ ...cur, restSec: sec }));
    rememberInRoutine(() => ({ restSec: sec }), sec == null ? `Rest back to your default, ${fmtRest(data.settings.restSec)}` : `Rest between sets: ${fmtRest(sec)}`);
  };

  const setExerciseRest = (ei: number, sec: number | null) => {
    const id = sRef.current.exercises[ei].exerciseId;
    const strip = <T extends { restSec?: number }>(x: T): T => {
      const { restSec: _drop, ...rest } = x; // eslint-disable-line @typescript-eslint/no-unused-vars
      return (sec == null ? rest : { ...rest, restSec: sec }) as T;
    };
    setExercise(ei, strip);
    const name = catalog.get(id).name;
    rememberInRoutine(
      (r) => (r.items.some((it) => it.exerciseId === id) ? { items: r.items.map((it) => (it.exerciseId === id ? strip(it) : it)) } : {}),
      sec == null ? `${name} uses the workout's rest again` : `${name}: ${fmtRest(sec)} rest`
    );
  };

  const addSet = (ei: number) =>
    setExercise(ei, (e) => {
      const last = e.sets[e.sets.length - 1];
      const ex = catalog.get(e.exerciseId);
      return { ...e, sets: [...e.sets, { reps: last?.reps ?? ex.reps, weightKg: last?.weightKg ?? null, done: false }] };
    });

  const removeLastSet = (ei: number) => setExercise(ei, (e) => ({ ...e, sets: e.sets.slice(0, -1) }));

  const move = (ei: number, dir: -1 | 1) =>
    update((cur) => {
      const j = ei + dir;
      if (j < 0 || j >= cur.exercises.length) return cur;
      const list = [...cur.exercises];
      [list[ei], list[j]] = [list[j], list[ei]];
      return { ...cur, exercises: list };
    });

  const removeExercise = (ei: number) => update((cur) => ({ ...cur, exercises: cur.exercises.filter((_, i) => i !== ei) }));

  const addExercise = (ex: Exercise) => {
    update((cur) => ({
      ...cur,
      exercises: [...cur.exercises, { exerciseId: ex.id, sets: Array.from({ length: ex.sets }, () => ({ reps: ex.reps, weightKg: null, done: false })) }],
    }));
    setAdding(false);
  };

  // ---------- finish / discard ----------
  const totals = sessionTotals(s.exercises);
  const unchecked = s.exercises.reduce((n, e) => n + e.sets.filter((x) => !x.done).length, 0);

  const finish = async () => {
    setBusy(true);
    if (!(await flush())) {
      setBusy(false);
      notify("Couldn't save the workout. Check the connection and try again.");
      return;
    }
    // Personal bests, measured against history before this workout
    const prs: FinishSummary["prs"] = [];
    for (const e of s.exercises) {
      const ex = catalog.get(e.exerciseId);
      if (ex.measure !== "weight") continue;
      const best = Math.max(0, ...e.sets.filter((x) => x.done).map((x) => e1rm(x.weightKg ?? 0, x.reps ?? 0)));
      const before = bestE1rm(data.history, e.exerciseId);
      if (best > 0 && before > 0 && best > before + 0.01) prs.push({ name: ex.name, kg: best });
    }
    const res = await attempt(() => api.finishSession(s.id));
    setBusy(false);
    setConfirm(null);
    if (!res) return;
    await reload();
    if (res.discarded) notify("Nothing was checked off, so the workout wasn't saved.");
    else
      onFinished({
        name: s.name, sets: totals.sets, volumeKg: totals.volumeKg, prs,
        durationMs: s.pastMin != null ? s.pastMin * 60_000 : Date.now() - s.startedAt,
      });
  };

  const discard = async () => {
    setBusy(true);
    window.clearTimeout(timer.current);
    pending.current = false;
    const ok = await attempt(() => api.deleteSession(s.id));
    setBusy(false);
    setConfirm(null);
    if (ok) {
      setData((d) => d && { ...d, activeSession: null });
      notify("Workout discarded.");
    }
  };

  return (
    <div className="stack logger">
      <div className="page-head logger-head">
        <div className="logger-title">
          <input
            className="title title-input"
            value={s.name}
            aria-label="Workout name"
            maxLength={60}
            onChange={(e) => update((cur) => ({ ...cur, name: e.target.value }))}
          />
          <p className="muted logger-meta">
            {past ? (
              <PastWhen s={s} onChange={(patch) => update((cur) => ({ ...cur, ...patch }))} />
            ) : (
              <>
                <Elapsed since={s.startedAt} />
                <RestSelect
                  value={s.restSec}
                  inherited={data.settings.restSec}
                  inheritLabel="Your default"
                  label="Rest between sets for this workout"
                  onChange={setWorkoutRest}
                />
              </>
            )}
            <span className={`save-state ${saveState}`}>{saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving" : "Not saved yet, retrying"}</span>
          </p>
        </div>
        <div className="row-gap">
          <button className="btn btn-ghost" onClick={() => setConfirm("discard")}>
            Discard
          </button>
          <button className="btn btn-chalk" onClick={() => (unchecked > 0 || totals.sets === 0 ? setConfirm("finish") : finish())} disabled={busy}>
            Finish
          </button>
        </div>
      </div>

      {s.exercises.length === 0 && (
        <section className="glass panel empty-panel">
          <p>Add the first exercise to start logging.</p>
        </section>
      )}

      {s.exercises.map((e, ei) => {
        const ex = catalog.get(e.exerciseId);
        return (
          <ExerciseBlock
            key={e.exerciseId}
            e={e}
            ei={ei}
            ex={ex}
            unit={unit}
            distUnit={data.settings.distanceUnit}
            count={s.exercises.length}
            prev={prev[e.exerciseId] ?? []}
            workoutRest={workoutRest}
            showRest={!past}
            machine={ex.measure === "weight" ? machineFor(e.exerciseId) : null}
            machines={data.machines}
            onMachine={(id) => chooseMachine(e.exerciseId, id)}
            suggestedSticker={(si) => suggestedSticker(e, si)}
            onRest={(sec) => setExerciseRest(ei, sec)}
            noteOpen={noteOpen?.key.startsWith(e.exerciseId + ":") ? { si: Number(noteOpen.key.split(":")[1]), focus: noteOpen.focus } : null}
            onOpenNote={(si) => setNoteOpen({ key: `${e.exerciseId}:${si}`, focus: true })}
            onCloseNote={() => setNoteOpen(null)}
            suggestedKg={(si) => suggestedKg(e, si)}
            onSet={(si, patch) => setSet(ei, si, patch)}
            onToggle={(si) => toggleDone(ei, si)}
            onAddSet={() => addSet(ei)}
            onRemoveLastSet={() => removeLastSet(ei)}
            onMove={(d) => move(ei, d)}
            onRemove={() => removeExercise(ei)}
            onGuide={() => openGuide(ex.id)}
          />
        );
      })}

      <button className="btn btn-glass wide" onClick={() => setAdding(true)}>
        <IconPlus /> Add exercise
      </button>

      <details className="glass panel notes">
        <summary>Notes</summary>
        <textarea
          value={s.notes}
          maxLength={2000}
          rows={3}
          placeholder="How did it feel? Anything to change next time?"
          onChange={(e) => update((cur) => ({ ...cur, notes: e.target.value }))}
          aria-label="Workout notes"
        />
      </details>

      <MachinesDialog
        open={!!machinesFor}
        onClose={() => setMachinesFor(null)}
        assignTo={machinesFor}
        onAssign={(exerciseId, id) => chooseMachine(exerciseId, id)}
      />

      <Modal open={adding} onClose={() => setAdding(false)} title="Add exercise" size="md">
        <ExercisePicker onPick={addExercise} isAdded={(id) => s.exercises.some((x) => x.exerciseId === id)} autoFocus />
      </Modal>

      <Modal
        open={confirm === "finish"}
        onClose={() => setConfirm(null)}
        title={totals.sets ? "Finish workout?" : "Nothing checked off yet"}
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setConfirm(null)}>
              Keep training
            </button>
            {totals.sets > 0 && (
              <button className="btn btn-chalk" onClick={finish} disabled={busy}>
                Save {totals.sets} {totals.sets === 1 ? "set" : "sets"}
              </button>
            )}
          </>
        }
      >
        {totals.sets ? (
          <p>
            {unchecked} {unchecked === 1 ? "set isn't" : "sets aren't"} checked off. Only checked sets are saved.
          </p>
        ) : (
          <p>Check off the sets you did, or discard the workout.</p>
        )}
      </Modal>

      <Modal
        open={confirm === "discard"}
        onClose={() => setConfirm(null)}
        title="Discard this workout?"
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setConfirm(null)}>
              Keep it
            </button>
            <button className="btn btn-danger" onClick={discard} disabled={busy}>
              Discard workout
            </button>
          </>
        }
      >
        <p>Everything logged in this workout will be deleted.</p>
      </Modal>
    </div>
  );
}

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return <span className="num">{formatDuration(now - since)}</span>;
}

/** For a workout logged afterwards: its day, start time and length, all editable. */
function PastWhen({ s, onChange }: { s: Session; onChange: (patch: Partial<Session>) => void }) {
  const today = pacificDate();
  const day = s.date;
  const time = pacificTime(s.startedAt);
  const move = (d: string, t: string) => {
    if (!d || !t) return;
    const at = pacificToEpoch(d, t);
    if (at > Date.now()) return;
    onChange({ startedAt: at, date: pacificDate(at) });
  };
  return (
    <span className="past-when">
      <span className="tag">Logged afterwards</span>
      <input type="date" value={day} max={today} aria-label="Day of the workout" onChange={(e) => move(e.target.value, time)} />
      <input type="time" value={time} aria-label="Start time" onChange={(e) => move(day, e.target.value)} />
      <label className="past-min">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={600}
          value={s.pastMin ?? 60}
          aria-label="Length in minutes"
          onChange={(e) => {
            const v = Math.round(Number(e.target.value));
            if (v >= 1 && v <= 600) onChange({ pastMin: v });
          }}
        />
        min
      </label>
    </span>
  );
}
