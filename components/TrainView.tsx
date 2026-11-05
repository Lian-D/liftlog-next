"use client";

import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { muscleSets, normalise } from "@/lib/stats";
import { TEMPLATES } from "@/lib/templates";
import { formatDuration, formatRelative } from "@/lib/time";
import type { Routine } from "@/lib/types";
import { fmtBig, fmtWeight, toUnit } from "@/lib/units";
import { useApp } from "./AppContext";
import BodyMap from "./BodyMap";
import { IconClock, IconEdit, IconPlus } from "./Icons";
import { BodyWeightChip } from "./BodyWeight";
import { SportRow } from "./Sports";
import Logger, { type FinishSummary } from "./Logger";
import Activity from "./Activity";

export default function TrainView() {
  const { data } = useApp();
  const [summary, setSummary] = useState<FinishSummary | null>(null);

  if (data.activeSession) {
    return <Logger key={data.activeSession.id} initial={data.activeSession} onFinished={setSummary} />;
  }
  return (
    <div className="stack">
      {summary && <Summary s={summary} onClose={() => setSummary(null)} />}
      <StartPanel />
      <Activity />
    </div>
  );
}

function Summary({ s, onClose }: { s: FinishSummary; onClose: () => void }) {
  const { unit } = useApp();
  return (
    <section className="glass panel summary" aria-labelledby="summary-title">
      <div className="row-between">
        <h2 id="summary-title" className="title">{s.name} saved</h2>
        <button className="btn btn-ghost" onClick={onClose}>
          Dismiss
        </button>
      </div>
      <p className="lede">
        <span className="num">{s.sets}</span> sets and <span className="num">{fmtBig(toUnit(s.volumeKg, unit))}</span> {unit} lifted in{" "}
        <span className="num">{formatDuration(s.durationMs)}</span>.
      </p>
      {s.prs.length > 0 && (
        <ul className="prs">
          {s.prs.map((p) => (
            <li key={p.name}>
              <strong>New best</strong> {p.name}: est. 1RM <span className="num">{fmtWeight(p.kg, unit)}</span> {unit}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function lastDoneText(date: string, today: string) {
  const rel = formatRelative(date, today);
  return rel === "Today" || rel === "Yesterday" ? rel.toLowerCase() : rel;
}

function StartPanel() {
  const { data, setData, attempt, catalog, editRoutine, today, notify, openPastWorkout } = useApp();
  const [busy, setBusy] = useState(false);

  const lastDone = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of data.sessions) if (s.routineId && !m.has(s.routineId)) m.set(s.routineId, s.date);
    return m;
  }, [data.sessions]);

  const start = async (r: Routine | null) => {
    setBusy(true);
    const session = await attempt(() => api.startSession(r?.id ?? null, r ? undefined : "Workout"));
    setBusy(false);
    if (session) setData((d) => d && { ...d, activeSession: session });
  };

  const useTemplate = async (t: (typeof TEMPLATES)[number]) => {
    setBusy(true);
    const r = await attempt(() => api.createRoutine(t.name, t.items));
    setBusy(false);
    if (r) {
      setData((d) => d && { ...d, routines: [...d.routines, r] });
      notify(`${t.name} routine added. Edit it any time under Routines.`);
    }
  };

  const newRoutine = async () => {
    const r = await attempt(() => api.createRoutine("New routine"));
    if (r) {
      setData((d) => d && { ...d, routines: [...d.routines, r] });
      editRoutine(r.id);
    }
  };

  // "Up next": the routine done longest ago (or never), when there's more than one to choose from
  const ready = data.routines.filter((r) => r.items.length);
  const upNext =
    ready.length > 1
      ? [...ready].sort((x, y) => (lastDone.get(x.id) ?? "").localeCompare(lastDone.get(y.id) ?? ""))[0]?.id
      : undefined;

  return (
    <>
      <div className="hello">
        <span className="avatar" aria-hidden="true">
          {data.me.username.slice(0, 1).toUpperCase()}
        </span>
        <p>Hi, {data.me.username}!</p>
        <BodyWeightChip />
      </div>
      <div className="page-head start-head">
        <h1 className="title">Start a workout</h1>
        {data.routines.length > 0 && (
          <div className="row-gap start-actions">
            <button className="btn btn-ghost" onClick={() => start(null)} disabled={busy}>
              Empty workout
            </button>
            <button className="btn btn-ghost" onClick={() => openPastWorkout()}>
              <IconClock /> Past workout
            </button>
            <button className="btn btn-ghost new-routine-btn" onClick={newRoutine} aria-label="New routine">
              <IconPlus /> <span>New routine</span>
            </button>
          </div>
        )}
      </div>

      {data.routines.length === 0 ? (
        <section className="glass panel" aria-labelledby="tpl-title">
          <h2 id="tpl-title" className="subtitle">Pick a starting routine</h2>
          <p className="muted">
            Each one is a ready-made list of exercises with sets and reps. Change anything afterwards, or build your own from the body map.
          </p>
          <div className="tpl-grid">
            {TEMPLATES.map((t) => {
              const load = normalise(muscleSets(t.items.map((i) => ({ exerciseId: i.exerciseId, sets: i.sets })), catalog));
              return (
                <article key={t.name} className="tpl">
                  <BodyMap label={`Muscles in ${t.name}`} intensity={load} compact />
                  <div>
                    <h3>{t.name}</h3>
                    <p className="muted">{t.blurb}</p>
                  </div>
                  <button className="btn btn-glass" onClick={() => useTemplate(t)} disabled={busy}>
                    Use {t.name}
                  </button>
                </article>
              );
            })}
          </div>
          <div className="row-gap">
            <button className="btn btn-chalk" onClick={newRoutine}>
              Build my own routine
            </button>
            <button className="btn btn-ghost" onClick={() => start(null)} disabled={busy}>
              Just log a workout
            </button>
            <button className="btn btn-ghost" onClick={() => openPastWorkout()}>
              Log a past workout
            </button>
          </div>
        </section>
      ) : (
        <ul className="start-list">
          {data.routines.map((r) => {
            const load = normalise(muscleSets(r.items.map((i) => ({ exerciseId: i.exerciseId, sets: i.sets })), catalog));
            const last = lastDone.get(r.id);
            const totalSets = r.items.reduce((n, i) => n + i.sets, 0);
            const next = r.id === upNext;
            return (
              <li key={r.id} className={`glass start-row${next ? " up-next" : ""}`}>
                <BodyMap label={`Muscles in ${r.name}`} intensity={load} compact />
                <div className="start-text">
                  <h2 className="start-name">
                    {r.name}
                    {next && <span className="tag tag-coral">Up next</span>}
                  </h2>
                  <p className="muted small">
                    {r.items.length ? `${r.items.length} exercises, ${totalSets} sets` : "No exercises yet"}
                    {r.items.length ? `. ${last ? `Last done ${lastDoneText(last, today)}` : "Not done yet"}` : ""}
                  </p>
                </div>
                <button className="icon-btn" onClick={() => editRoutine(r.id)} aria-label={`Edit ${r.name}`}>
                  <IconEdit />
                </button>
                <button className="btn btn-chalk start-btn" onClick={() => start(r)} disabled={busy || !r.items.length} aria-label={`Start ${r.name}`}>
                  Start
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <SportRow />
    </>
  );
}
