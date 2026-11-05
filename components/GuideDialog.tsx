"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { IMAGE_CREDIT } from "@/lib/exercises";
import { MUSCLE_LABEL } from "@/lib/muscles";
import { bestE1rm, bestReps } from "@/lib/stats";
import { fmtClockSec, fmtWeight } from "@/lib/units";
import { useApp } from "./AppContext";
import BodyMap from "./BodyMap";
import { ExerciseFrames } from "./ExerciseArt";
import Modal from "./Modal";
import SetupNote from "./SetupNote";

const MEASURE_NOTE = {
  weight: null,
  bodyweight: "Logged as reps, with any added weight (0 for bodyweight).",
  time: "Logged in seconds rather than reps.",
  cardio: "Each bout logs its time and the machine's numbers; calories and heart rate are optional.",
};

export default function GuideDialog({ exerciseId, onClose }: { exerciseId: string | null; onClose: () => void }) {
  const { catalog, data, setData, unit, attempt, notify } = useApp();
  const ex = exerciseId ? catalog.get(exerciseId) : null;
  const [routineId, setRoutineId] = useState("");
  const [noteEditing, setNoteEditing] = useState(false);

  useEffect(() => {
    if (exerciseId) setRoutineId(data.routines[0]?.id ?? "");
  }, [exerciseId, data.routines]);

  if (!ex) return <Modal open={false} onClose={onClose} title="">{null}</Modal>;

  const intensity = Object.fromEntries([...ex.primary.map((m) => [m, 1]), ...ex.secondary.map((m) => [m, 0.4])]);
  const best = ex.measure === "weight" ? bestE1rm(data.history, ex.id) : bestReps(data.history, ex.id);
  const target = data.routines.find((r) => r.id === routineId);
  const alreadyIn = !!target?.items.some((i) => i.exerciseId === ex.id);

  const addToRoutine = async () => {
    if (!target || alreadyIn) return;
    const items = [...target.items, { exerciseId: ex.id, sets: ex.sets, reps: ex.reps }];
    const saved = await attempt(() => api.updateRoutine(target.id, { items }));
    if (saved) {
      setData((d) => d && { ...d, routines: d.routines.map((r) => (r.id === saved.id ? saved : r)) });
      notify(`Added ${ex.name} to ${saved.name}`);
    }
  };

  return (
    <Modal open={!!exerciseId} onClose={onClose} title={ex.name} size="lg">
      <div className="guide">
        <div className="guide-art">
          {ex.image ? <ExerciseFrames ex={ex} /> : <p className="muted">{ex.custom ? "Your own exercise, so there\u2019s no drawing." : "No drawing for this one."}</p>}
        </div>

        <div className="guide-side">
          <BodyMap label={`Muscles worked by ${ex.name}`} intensity={intensity} compact />
          <dl className="guide-facts">
            <div>
              <dt>Main</dt>
              <dd>{ex.primary.map((m) => MUSCLE_LABEL[m]).join(", ") || "Not set"}</dd>
            </div>
            {ex.secondary.length > 0 && (
              <div>
                <dt>Also</dt>
                <dd>{ex.secondary.map((m) => MUSCLE_LABEL[m]).join(", ")}</dd>
              </div>
            )}
            <div>
              <dt>Equipment</dt>
              <dd>{ex.equipment}</dd>
            </div>
            {best > 0 && (
              <div>
                <dt>{ex.measure === "weight" ? "Best est. 1RM" : ex.measure === "time" ? "Longest hold" : "Most reps"}</dt>
                <dd className="num">
                  {ex.measure === "weight" ? `${fmtWeight(best, unit)} ${unit}` : ex.measure === "time" ? `${best} s` : ex.measure === "cardio" ? fmtClockSec(best) : best}
                </dd>
              </div>
            )}
          </dl>
        </div>

        <section className="guide-setup">
          <h3>Your setup note</h3>
          {!noteEditing && !data.exercisePrefs[ex.id]?.note && (
            <button className="btn btn-glass" onClick={() => setNoteEditing(true)}>
              Add a setup note
            </button>
          )}
          <SetupNote exerciseId={ex.id} name={ex.name} editing={noteEditing} setEditing={setNoteEditing} />
          <p className="muted small">Rack and pin heights, seat settings, grip. It shows under this exercise in every workout.</p>
        </section>
        {ex.steps.length > 0 && (
          <section className="guide-steps">
            <h3>How to do it</h3>
            <ol>
              {ex.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </section>
        )}
        {(ex.cues.length > 0 || MEASURE_NOTE[ex.measure]) && (
          <section className="guide-cues">
            <h3>Tips</h3>
            <ul>
              {ex.cues.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
              {MEASURE_NOTE[ex.measure] && !ex.cues.some((c) => c.toLowerCase().includes("log")) && <li>{MEASURE_NOTE[ex.measure]}</li>}
            </ul>
          </section>
        )}

        <div className="guide-add">
          {data.routines.length ? (
            <>
              <label htmlFor="guide-routine">Add to routine</label>
              <select id="guide-routine" value={routineId} onChange={(e) => setRoutineId(e.target.value)}>
                {data.routines.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <button className="btn btn-chalk" onClick={addToRoutine} disabled={alreadyIn}>
                {alreadyIn ? "Already in routine" : `Add ${ex.sets} × ${ex.reps}${ex.measure === "time" ? " s" : ""}`}
              </button>
            </>
          ) : (
            <p className="muted">Create a routine in the Routines tab to add this exercise to it.</p>
          )}
        </div>

        {ex.image && (
          <p className="credit">
            <a href={IMAGE_CREDIT.href} target="_blank" rel="noopener noreferrer">
              {IMAGE_CREDIT.text}
            </a>
          </p>
        )}
      </div>
    </Modal>
  );
}
