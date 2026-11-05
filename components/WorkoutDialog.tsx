"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { MUSCLE_LABEL } from "@/lib/muscles";
import { e1rm } from "@/lib/stats";
import { TZ } from "@/lib/time";
import type { Session } from "@/lib/types";
import { fmtBig, fmtWeight, toUnit } from "@/lib/units";
import { useApp } from "./AppContext";
import { ExerciseThumb } from "./ExerciseArt";
import { cardioText } from "./ExerciseBlock";
import { IconNote, IconScale } from "./Icons";
import Modal from "./Modal";

const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });

/** A finished workout in full: every exercise and set, notes, bests, and repeat or delete. */
export default function WorkoutDialog({ sessionId, onClose }: { sessionId: string | null; onClose: () => void }) {
  const { data, setData, catalog, unit, attempt, notify, openWorkout, go } = useApp();
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSession(null);
    setError(null);
    setConfirming(false);
    if (!sessionId) return;
    let live = true;
    api.getSession(sessionId).then(
      (s) => live && setSession(s),
      (e) => live && setError((e as Error).message)
    );
    return () => {
      live = false;
    };
  }, [sessionId]);

  const summary = data.sessions.find((s) => s.id === sessionId);
  const sameDay = summary ? data.sessions.filter((s) => s.date === summary.date && s.id !== summary.id) : [];
  const dayWeight = summary ? data.bodyWeights.find((b) => b.date === summary.date) : undefined;

  // Bests before this workout, to flag sets that beat them
  const priorBest = useMemo(() => {
    const m = new Map<string, number>();
    if (!summary) return m;
    const startedAt = new Map(data.sessions.map((s) => [s.id, s.startedAt]));
    for (const [sid, , ex, reps, kg] of data.history) {
      if ((startedAt.get(sid) ?? Infinity) >= summary.startedAt) continue;
      m.set(ex, Math.max(m.get(ex) ?? 0, e1rm(kg, reps)));
    }
    return m;
  }, [data.history, data.sessions, summary]);

  let sets = 0;
  let volumeKg = 0;
  for (const e of session?.exercises ?? [])
    for (const s of e.sets) {
      sets++;
      volumeKg += (s.weightKg ?? 0) * (s.reps ?? 0);
    }
  const minutes = summary ? Math.max(1, Math.round((summary.finishedAt - summary.startedAt) / 60_000)) : 0;

  const repeat = async () => {
    if (!session) return;
    setBusy(true);
    const s = await attempt(() => api.repeatSession(session.id));
    setBusy(false);
    if (s) {
      setData((d) => d && { ...d, activeSession: s });
      onClose();
      go("train");
    }
  };

  const remove = async () => {
    if (!session) return;
    setBusy(true);
    const ok = await attempt(() => api.deleteSession(session.id));
    setBusy(false);
    if (ok) {
      setData((d) => d && { ...d, sessions: d.sessions.filter((s) => s.id !== session.id), history: d.history.filter((r) => r[0] !== session.id) });
      notify(`Deleted ${session.name} from your history.`);
      onClose();
    }
  };

  const footer = confirming ? (
    <>
      <span className="wk-confirm">Delete this workout and its {sets} sets?</span>
      <button className="btn btn-ghost" onClick={() => setConfirming(false)}>
        Keep it
      </button>
      <button className="btn btn-danger" onClick={remove} disabled={busy}>
        Delete workout
      </button>
    </>
  ) : (
    <>
      <button className="btn btn-ghost danger wk-delete" onClick={() => setConfirming(true)} disabled={!session}>
        Delete
      </button>
      {data.activeSession && <span className="muted small">Finish the workout in progress to repeat this one.</span>}
      <button className="btn btn-chalk" onClick={repeat} disabled={!session || busy || !!data.activeSession}>
        Repeat this workout
      </button>
    </>
  );

  return (
    <Modal open={!!sessionId} onClose={onClose} title={session?.name ?? summary?.name ?? "Workout"} size="lg" footer={footer}>
      {error ? (
        <p role="alert">{error}</p>
      ) : !session || !summary ? (
        <p className="muted">Loading the workout…</p>
      ) : (
        <div className="wk">
          <p className="wk-when">
            {dayFmt.format(summary.startedAt)}, {timeFmt.format(summary.startedAt)} to {timeFmt.format(summary.finishedAt)}
            {session.pastMin != null && <span className="tag">Logged afterwards</span>}
          </p>
          {dayWeight && (
            <p className="wk-bw muted">
              <IconScale aria-hidden="true" /> Bodyweight that day: {dayWeight.kg != null ? `${fmtWeight(dayWeight.kg, unit)} ${unit}` : "not weighed"}
              {dayWeight.note && <span> · {dayWeight.note}</span>}
            </p>
          )}

          <dl className="wk-stats">
            <div>
              <dt>Sets</dt>
              <dd className="num">{sets}</dd>
            </div>
            <div>
              <dt>Volume</dt>
              <dd className="num">
                {fmtBig(toUnit(volumeKg, unit))}
                <span className="unit">{unit}</span>
              </dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd className="num">
                {minutes}
                <span className="unit">min</span>
              </dd>
            </div>
            <div>
              <dt>Exercises</dt>
              <dd className="num">{session.exercises.length}</dd>
            </div>
          </dl>

          {sameDay.length > 0 && (
            <p className="wk-sameday muted">
              Also on this day:{" "}
              {sameDay.map((s) => (
                <button key={s.id} className="chip" onClick={() => openWorkout(s.id)}>
                  {s.name}
                </button>
              ))}
            </p>
          )}

          {session.notes && <blockquote className="wk-notes">{session.notes}</blockquote>}

          <ol className="wk-list">
            {session.exercises.map((e) => {
              const ex = catalog.get(e.exerciseId);
              const weighted = ex.measure === "weight";
              const ests = e.sets.map((s) => (weighted ? e1rm(s.weightKg ?? 0, s.reps ?? 0) : 0));
              const best = Math.max(0, ...ests);
              const bestAt = best > 0 ? ests.indexOf(best) : -1;
              const before = priorBest.get(e.exerciseId) ?? 0;
              const pr = weighted && before > 0 && best > before + 0.01;
              return (
                <li key={e.exerciseId} className="wk-ex">
                  <div className="wk-ex-head">
                    <ExerciseThumb ex={ex} size={44} />
                    <div className="wk-ex-name">
                      <strong>{ex.name}</strong>
                      <span className="muted small">{ex.primary.map((m) => MUSCLE_LABEL[m]).join(", ")}</span>
                    </div>
                    {pr && <span className="wk-pr">New best</span>}
                  </div>
                  <table className="wk-sets">
                    <thead>
                      <tr>
                        <th scope="col">Set</th>
                        <th scope="col">{ex.measure === "time" ? "Time" : weighted ? `${unit} × reps` : "Reps"}</th>
                        {weighted && <th scope="col">Est. 1RM</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {e.sets.map((s, i) => (
                        <Fragment key={i}>
                        <tr className={`${i === bestAt ? "best" : ""}${s.note ? " has-note" : ""}`}>
                          <td>{i + 1}</td>
                          <td className="num">
                            {ex.measure === "cardio"
                              ? cardioText(ex, s, data.settings.distanceUnit)
                              : ex.measure === "time"
                              ? `${s.reps ?? 0} s`
                              : ex.measure === "bodyweight"
                                ? s.weightKg
                                  ? `+${fmtWeight(s.weightKg, unit)} × ${s.reps ?? 0}`
                                  : `${s.reps ?? 0} reps`
                                : `${fmtWeight(s.weightKg, unit)} × ${s.reps ?? 0}`}
                            {s.x?.sticker != null && <span className="wk-sticker"> #{s.x.sticker}</span>}
                          </td>
                          {weighted && <td className="num">{ests[i] ? fmtWeight(ests[i], unit) : "–"}</td>}
                        </tr>
                        {s.note && (
                          <tr className="wk-note">
                            <td aria-hidden="true" />
                            <td colSpan={weighted ? 2 : 1}>
                              <IconNote aria-hidden="true" /> {s.note}
                            </td>
                          </tr>
                        )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </Modal>
  );
}
