"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { muscleSets, normalise } from "@/lib/stats";
import { PROGRAMS, type Program, type Template } from "@/lib/templates";
import type { Routine, RoutineItem } from "@/lib/types";
import { fmtRest } from "./RestSelect";
import { useApp } from "./AppContext";
import BodyMap from "./BodyMap";
import { IconCheck, IconPlus } from "./Icons";

/** The premade programs, each with its routines and a button to copy them into yours. */
export default function PremadePrograms() {
  const { data, setData, attempt, notify, catalog, editRoutine } = useApp();
  const [busy, setBusy] = useState(false);
  const has = (t: Template) => data.routines.some((r) => r.name === t.name);

  const add = async (list: Template[], program: Program) => {
    setBusy(true);
    const made: Routine[] = [];
    for (const t of list) {
      const r = await attempt(() => api.createRoutine(t.name, t.items, t.restSec ?? null));
      if (!r) break;
      made.push(r);
    }
    setBusy(false);
    if (!made.length) return;
    setData((d) => d && { ...d, routines: [...d.routines, ...made] });
    notify(
      made.length === 1
        ? `${made[0].name} added to your routines. Start it from Train, or edit it any time.`
        : `${program.name}: ${made.map((r) => r.name).join(", ")} added to your routines.`
    );
  };

  const line = (it: RoutineItem) => {
    const ex = catalog.get(it.exerciseId);
    const amount =
      ex.measure === "cardio" ? `${Math.round(it.reps / 60)} min` : ex.measure === "time" ? `${it.sets} × ${it.reps} s` : `${it.sets} × ${it.reps}`;
    return { name: ex.name, amount };
  };

  return (
    <div className="stack premade">
      {PROGRAMS.map((p) => {
        const missing = p.routines.filter((t) => !has(t));
        return (
          <section key={p.id} className="glass panel program" aria-labelledby={`prog-${p.id}`}>
            <div className="row-between program-head">
              <div>
                <h2 id={`prog-${p.id}`} className="subtitle">
                  {p.name}
                </h2>
                <p className="muted">{p.blurb}</p>
              </div>
              {p.routines.length > 1 && (
                <button className="btn btn-chalk" onClick={() => add(missing, p)} disabled={busy || !missing.length}>
                  {missing.length ? (missing.length === p.routines.length ? `Add all ${p.routines.length}` : `Add the other ${missing.length}`) : "All added"}
                </button>
              )}
            </div>
            <p className="small program-how">{p.how}</p>
            <div className="tpl-grid">
              {p.routines.map((t) => {
                const load = normalise(muscleSets(t.items.map((i) => ({ exerciseId: i.exerciseId, sets: i.sets })), catalog));
                const added = has(t);
                const mine = data.routines.find((r) => r.name === t.name);
                return (
                  <article key={t.name} className="tpl">
                    <BodyMap label={`Muscles in ${t.name}`} intensity={load} compact />
                    <div>
                      <h3>{t.name}</h3>
                      <p className="muted small">
                        {t.blurb}
                        {t.restSec ? `. ${fmtRest(t.restSec)} rest` : ""}
                      </p>
                    </div>
                    <ul className="tpl-items">
                      {t.items.map((it) => {
                        const l = line(it);
                        return (
                          <li key={it.exerciseId}>
                            <span>{l.name}</span>
                            <span className="num muted">{l.amount}</span>
                          </li>
                        );
                      })}
                    </ul>
                    {added && mine ? (
                      <button className="btn btn-ghost" onClick={() => editRoutine(mine.id)}>
                        <IconCheck /> In your routines
                      </button>
                    ) : (
                      <button className="btn btn-glass" onClick={() => add([t], p)} disabled={busy}>
                        <IconPlus /> Add {t.name}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
