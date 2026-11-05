"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Machine } from "@/lib/types";
import { fmtWeight, fromUnit, round1, toUnit } from "@/lib/units";
import { useApp } from "./AppContext";
import { NumInput, stickerFactor } from "./ExerciseBlock";
import { IconEdit, IconPlus, IconTrash } from "./Icons";
import Modal from "./Modal";

type Draft = { id: string | null; name: string; real: number | undefined; sticker: number | undefined };

/**
 * Machines whose stack numbers aren't real weights. Each one is calibrated by a
 * single reading you know the truth of, e.g. the lowest stack number that holds
 * you in a dead hang on the lat pulldown is your bodyweight: 175 lb = sticker 140.
 * Every sticker on that machine is then scaled by the same factor.
 */
export default function MachinesDialog({
  open,
  onClose,
  assignTo,
  onAssign,
}: {
  open: boolean;
  onClose: () => void;
  /** Opened from an exercise: offer to use a machine for it */
  assignTo?: { exerciseId: string; name: string } | null;
  onAssign?: (exerciseId: string, machineId: string) => void;
}) {
  const { data, setData, unit, attempt, notify } = useApp();
  const machines = data.machines;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [calcId, setCalcId] = useState("");
  const [calcSticker, setCalcSticker] = useState<number | undefined>(undefined);
  const [calcReal, setCalcReal] = useState<number | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const bw = [...data.bodyWeights].reverse().find((b) => b.kg != null);

  useEffect(() => {
    if (!open) return;
    setDraft(machines.length === 0 ? { id: null, name: assignTo?.name ?? "", real: undefined, sticker: undefined } : null);
    setCalcId(machines[0]?.id ?? "");
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const calc = machines.find((m) => m.id === calcId) ?? machines[0];
  const factorText = (m: Pick<Machine, "realKg" | "sticker">) => `1 on the stack = ${Math.round(toUnit(m.realKg / m.sticker, unit) * 100) / 100} ${unit}`;

  const save = async () => {
    if (!draft || !draft.name.trim() || !draft.real || !draft.sticker) return;
    setBusy(true);
    const body = { name: draft.name.trim(), realKg: fromUnit(draft.real, unit), sticker: draft.sticker };
    const saved = await attempt(() => (draft.id ? api.machines.update(draft.id, body) : api.machines.create(body)));
    setBusy(false);
    if (!saved) return;
    setData((d) => d && { ...d, machines: [...d.machines.filter((m) => m.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name)) });
    setDraft(null);
    setCalcId(saved.id);
    if (!draft.id && assignTo && onAssign) {
      onAssign(assignTo.exerciseId, saved.id);
      notify(`${assignTo.name} now logs ${saved.name} stickers.`);
      onClose();
    } else notify(`Saved ${saved.name}.`);
  };

  const remove = async (m: Machine) => {
    const ok = await attempt(() => api.machines.remove(m.id));
    if (!ok) return;
    setData(
      (d) =>
        d && {
          ...d,
          machines: d.machines.filter((x) => x.id !== m.id),
          exercisePrefs: Object.fromEntries(Object.entries(d.exercisePrefs).map(([k, v]) => [k, v.machineId === m.id ? { ...v, machineId: null } : v])),
        }
    );
    notify(`Deleted ${m.name}. Exercises that used it are back to real weights; logged sets keep their weights.`);
  };

  const preview = draft?.real && draft?.sticker ? factorText({ realKg: fromUnit(draft.real, unit), sticker: draft.sticker }) : null;

  return (
    <Modal open={open} onClose={onClose} title="Machine stickers" size="sm">
      <div className="machines">
        <p className="muted">
          For machines whose stack numbers aren&rsquo;t real {unit}. Find one setting you know the true weight of, like the lowest number that holds you in a dead hang
          on the lat pulldown (your bodyweight), and every other number on that machine is converted the same way.
        </p>

        {calc && !draft && (
          <section className="calc" aria-labelledby="calc-h">
            <h3 id="calc-h">Calculator</h3>
            {machines.length > 1 && (
              <select className="select" value={calc.id} onChange={(e) => setCalcId(e.target.value)} aria-label="Machine">
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
            <div className="calc-row">
              <label>
                <span>Sticker</span>
                <NumInput value={calcSticker} placeholder={String(calc.sticker)} label={`Sticker number on ${calc.name}`} onChange={(v) => { setCalcSticker(v); setCalcReal(undefined); }} />
              </label>
              <span className="calc-eq" aria-hidden="true">=</span>
              <label>
                <span>{unit}</span>
                <NumInput
                  value={calcReal ?? (calcSticker != null ? round1(toUnit(calcSticker * stickerFactor(calc), unit)) : undefined)}
                  placeholder={fmtWeight(calc.realKg, unit)}
                  label={`Real weight in ${unit}`}
                  onChange={(v) => { setCalcReal(v); setCalcSticker(v == null ? undefined : round1(fromUnit(v, unit) / stickerFactor(calc))); }}
                />
              </label>
            </div>
            <p className="muted small">{calc.name}: {factorText(calc)}</p>
          </section>
        )}

        {!draft && machines.length > 0 && (
          <ul className="machine-list">
            {machines.map((m) => (
              <li key={m.id}>
                <div className="machine-text">
                  <strong>{m.name}</strong>
                  <span className="muted small">
                    {fmtWeight(m.realKg, unit)} {unit} = {m.sticker} on the stack · {factorText(m)}
                  </span>
                </div>
                {assignTo && onAssign && (
                  <button
                    className="btn btn-chalk small-btn"
                    onClick={() => {
                      onAssign(assignTo.exerciseId, m.id);
                      notify(`${assignTo.name} now logs ${m.name} stickers.`);
                      onClose();
                    }}
                  >
                    Use
                  </button>
                )}
                <button className="icon-btn" onClick={() => setDraft({ id: m.id, name: m.name, real: round1(toUnit(m.realKg, unit)), sticker: m.sticker })} aria-label={`Edit ${m.name}`}>
                  <IconEdit />
                </button>
                <button className="icon-btn" onClick={() => remove(m)} aria-label={`Delete ${m.name}`}>
                  <IconTrash />
                </button>
              </li>
            ))}
          </ul>
        )}

        {draft ? (
          <form
            className="machine-form"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <h3>{draft.id ? `Edit ${draft.name || "machine"}` : "New machine"}</h3>
            <label className="field">
              <span>Name</span>
              <input value={draft.name} maxLength={60} placeholder="Lat pulldown (my gym)" onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
            </label>
            <div className="calc-row">
              <label className="field">
                <span>Real weight ({unit})</span>
                <NumInput value={draft.real} placeholder={bw ? fmtWeight(bw.kg, unit) : "175"} label={`Real weight in ${unit}`} onChange={(v) => setDraft({ ...draft, real: v })} />
              </label>
              <span className="calc-eq" aria-hidden="true">=</span>
              <label className="field">
                <span>Sticker</span>
                <NumInput value={draft.sticker} placeholder="140" label="Sticker number at that weight" onChange={(v) => setDraft({ ...draft, sticker: v })} />
              </label>
            </div>
            {bw && (
              <button type="button" className="link-btn small" onClick={() => setDraft({ ...draft, real: round1(toUnit(bw.kg!, unit)) })}>
                Use my bodyweight ({fmtWeight(bw.kg, unit)} {unit})
              </button>
            )}
            <p className="muted small">{preview ?? "Enter a stack number and what it really weighs."}</p>
            {draft.id && <p className="muted small">Sets you&rsquo;ve already logged keep the weights they were saved with.</p>}
            <div className="row-gap">
              {(machines.length > 0 || draft.id) && (
                <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)}>
                  Cancel
                </button>
              )}
              <button className="btn btn-chalk" type="submit" disabled={busy || !draft.name.trim() || !draft.real || !draft.sticker}>
                {draft.id ? "Save" : assignTo ? `Save and use for ${assignTo.name}` : "Save machine"}
              </button>
            </div>
          </form>
        ) : (
          <button className="btn btn-glass wide" onClick={() => setDraft({ id: null, name: "", real: undefined, sticker: undefined })}>
            <IconPlus /> Add a machine
          </button>
        )}
      </div>
    </Modal>
  );
}
