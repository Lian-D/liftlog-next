"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { addDays, formatLong, formatShort, pacificDate } from "@/lib/time";
import { fmtWeight, fromUnit, round1, toUnit } from "@/lib/units";
import { useApp } from "./AppContext";
import { NumInput } from "./ExerciseBlock";
import { IconScale } from "./Icons";
import Modal from "./Modal";

/** Train's hello row: today's weigh-in, or the latest one, or a prompt. */
export function BodyWeightChip() {
  const { data, unit, today, openBodyWeight } = useApp();
  const last = [...data.bodyWeights].reverse().find((b) => b.kg != null);
  const isToday = last?.date === today;
  return (
    <button className={`bw-chip${isToday ? " today" : ""}`} onClick={() => openBodyWeight()} aria-label={last ? `Bodyweight ${fmtWeight(last.kg, unit)} ${unit} on ${formatLong(last.date)}. Log or edit` : "Log bodyweight"}>
      <IconScale />
      {last ? (
        <>
          <span className="num">{fmtWeight(last.kg, unit)}</span>
          <span className="bw-unit">{unit}</span>
          <span className="bw-when">{isToday ? "today" : formatShort(last.date)}</span>
        </>
      ) : (
        <span>Bodyweight</span>
      )}
    </button>
  );
}

/** One day's bodyweight and note, plus the last few weigh-ins. */
export function BodyWeightDialog({ date, onClose }: { date: string | null; onClose: () => void }) {
  const { data, setData, unit, attempt, notify } = useApp();
  const [day, setDay] = useState("");
  const [kg, setKg] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const today = pacificDate();

  const load = (d: string) => {
    const e = data.bodyWeights.find((b) => b.date === d);
    setDay(d);
    setKg(e?.kg ?? null);
    setNote(e?.note ?? "");
  };
  useEffect(() => {
    if (date) load(date);
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (clear = false) => {
    if (!day) return;
    setBusy(true);
    const all = await attempt(() => api.saveBodyWeight(day, clear ? null : kg, clear ? "" : note.trim()));
    setBusy(false);
    if (!all) return;
    setData((d) => d && { ...d, bodyWeights: all });
    notify(clear ? `Cleared ${formatLong(day)}.` : `Saved for ${formatLong(day)}.`);
    onClose();
  };

  const recent = [...data.bodyWeights].reverse().slice(0, 8);
  const exists = data.bodyWeights.some((b) => b.date === day);
  const shown = kg != null ? round1(toUnit(kg, unit)) : undefined;

  return (
    <Modal
      open={!!date}
      onClose={onClose}
      title="Bodyweight"
      size="sm"
      footer={
        <>
          {exists && (
            <button className="btn btn-ghost danger wk-delete" onClick={() => save(true)} disabled={busy}>
              Clear day
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-chalk" onClick={() => save()} disabled={busy || (kg == null && !note.trim())}>
            Save
          </button>
        </>
      }
    >
      <form
        className="bw-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="form-grid two">
          <label className="field">
            <span>Day</span>
            <input type="date" value={day} max={addDays(today, 0)} onChange={(e) => e.target.value && load(e.target.value)} />
          </label>
          <label className="field">
            <span>Weight ({unit})</span>
            <NumInput value={shown} placeholder={recent[0]?.kg != null ? fmtWeight(recent[0].kg, unit) : unit === "lb" ? "175" : "80"} label={`Bodyweight in ${unit}`} onChange={(v) => setKg(v == null ? null : fromUnit(v, unit))} />
          </label>
        </div>
        <label className="field">
          <span>Note</span>
          <textarea rows={2} maxLength={300} value={note} placeholder="Morning, before breakfast; felt bloated; new scale…" onChange={(e) => setNote(e.target.value)} />
        </label>
        <button type="submit" hidden />
      </form>
      {recent.length > 0 && (
        <section className="bw-recent" aria-labelledby="bw-recent-h">
          <h3 id="bw-recent-h">Recent</h3>
          <ul>
            {recent.map((b, i) => {
              const before = recent.slice(i + 1).find((x) => x.kg != null);
              const diff = b.kg != null && before?.kg != null ? round1(toUnit(b.kg, unit) - toUnit(before.kg, unit)) : null;
              return (
                <li key={b.date}>
                  <button className={b.date === day ? "on" : ""} onClick={() => load(b.date)}>
                    <span className="bw-day">{formatShort(b.date)}</span>
                    <span className="num">{b.kg != null ? `${fmtWeight(b.kg, unit)} ${unit}` : "–"}</span>
                    <span className={`num bw-diff${diff ? (diff > 0 ? " up" : " down") : ""}`}>{diff ? `${diff > 0 ? "+" : ""}${diff}` : ""}</span>
                    <span className="bw-note muted">{b.note}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </Modal>
  );
}
