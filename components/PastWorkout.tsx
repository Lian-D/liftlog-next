"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { addDays, formatLong, pacificDate, pacificToEpoch } from "@/lib/time";
import { useApp } from "./AppContext";
import Modal from "./Modal";

/** Log a workout that already happened: pick the day, time, length and what it was. */
export function PastWorkoutDialog({ date, onClose }: { date: string | null; onClose: () => void }) {
  const { data, setData, attempt, notify, go } = useApp();
  const today = pacificDate();
  const [day, setDay] = useState("");
  const [time, setTime] = useState("18:00");
  const [min, setMin] = useState(60);
  const [routineId, setRoutineId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!date) return;
    setDay(date);
    const ready = data.routines.filter((r) => r.items.length);
    setRoutineId(ready[0]?.id ?? "");
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  const at = day && time ? pacificToEpoch(day, time) : NaN;
  const problem = !day || !time ? "Pick a day and start time." : at > Date.now() ? "That start time hasn't happened yet." : !(min >= 1 && min <= 600) ? "Length is 1 to 600 minutes." : "";
  const routine = data.routines.find((r) => r.id === routineId);

  const start = async () => {
    if (problem) return;
    setBusy(true);
    const s = await attempt(() => api.startSession(routine?.id ?? null, routine ? undefined : "Workout", { at, pastMin: min }));
    setBusy(false);
    if (!s) return;
    setData((d) => d && { ...d, activeSession: s });
    onClose();
    go("train");
    notify(`Logging ${s.name} for ${formatLong(s.date)}. Tick the sets you did, then Finish.`);
  };

  return (
    <Modal
      open={!!date}
      onClose={onClose}
      title="Log a past workout"
      size="sm"
      footer={
        data.activeSession ? (
          <button
            className="btn btn-chalk"
            onClick={() => {
              onClose();
              go("train");
            }}
          >
            Go to the workout in progress
          </button>
        ) : (
          <>
            {problem && <span className="muted small form-problem">{problem}</span>}
            <button className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-chalk" onClick={start} disabled={busy || !!problem}>
              Start logging
            </button>
          </>
        )
      }
    >
      {data.activeSession ? (
        <p>Finish or discard the workout in progress first, then log the past one.</p>
      ) : (
        <form
          className="past-form"
          onSubmit={(e) => {
            e.preventDefault();
            void start();
          }}
        >
          <p className="muted">It&rsquo;s saved on the day you pick, so History, the heatmap, streaks and charts count it like any other workout.</p>
          <div className="form-grid">
            <label className="field">
              <span>Day</span>
              <input type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} />
            </label>
            <label className="field">
              <span>Started</span>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
            <label className="field">
              <span>Length (min)</span>
              <input type="number" inputMode="numeric" min={1} max={600} value={min} onChange={(e) => setMin(Math.round(Number(e.target.value)))} />
            </label>
          </div>
          <div className="field">
            <span id="past-what">What you did</span>
            <div className="sport-chips wrap" role="radiogroup" aria-labelledby="past-what">
              {data.routines
                .filter((r) => r.items.length)
                .map((r) => (
                  <button key={r.id} type="button" role="radio" aria-checked={routineId === r.id} className={`chip${routineId === r.id ? " on" : ""}`} onClick={() => setRoutineId(r.id)}>
                    {r.name}
                  </button>
                ))}
              <button type="button" role="radio" aria-checked={routineId === ""} className={`chip${routineId === "" ? " on" : ""}`} onClick={() => setRoutineId("")}>
                Empty workout
              </button>
            </div>
          </div>
          <div className="quick-days">
            {[1, 2, 3].map((n) => {
              const d = addDays(today, -n);
              return (
                <button key={n} type="button" className={`link-btn small${day === d ? " on" : ""}`} onClick={() => setDay(d)}>
                  {n === 1 ? "Yesterday" : formatLong(d).split(",")[0]}
                </button>
              );
            })}
          </div>
          <button type="submit" hidden />
        </form>
      )}
    </Modal>
  );
}
