"use client";

import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Measure } from "@/lib/exercises";
import { IMAGE_CREDIT } from "@/lib/exercises";
import { MUSCLES, MUSCLE_LABEL, type Muscle } from "@/lib/muscles";
import { useApp } from "./AppContext";
import BodyMap from "./BodyMap";
import { ExerciseThumb } from "./ExerciseArt";
import { filterExercises, MuscleChips } from "./ExercisePicker";
import { IconSearch, IconStack, IconTrash } from "./Icons";
import MachinesDialog from "./Machines";
import Modal from "./Modal";

export default function ExercisesView() {
  const { catalog, openGuide, setData, attempt, notify } = useApp();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<Muscle>>(new Set());
  const [equipment, setEquipment] = useState("");
  const [creating, setCreating] = useState(false);
  const [machines, setMachines] = useState(false);

  const equipmentList = useMemo(() => [...new Set(catalog.all.map((e) => e.equipment))].sort(), [catalog.all]);
  const list = useMemo(() => filterExercises(catalog.all, q, sel, equipment), [catalog.all, q, sel, equipment]);
  const counts = useMemo(() => {
    const c: Partial<Record<Muscle, number>> = {};
    for (const e of catalog.all) for (const m of e.primary) c[m] = (c[m] ?? 0) + 1;
    return c;
  }, [catalog.all]);

  const toggle = (m: Muscle) => {
    const next = new Set(sel);
    if (next.has(m)) next.delete(m);
    else next.add(m);
    setSel(next);
  };

  const removeCustom = async (id: string, name: string) => {
    if (await attempt(() => api.deleteExercise(id))) {
      setData((d) => d && { ...d, customExercises: d.customExercises.filter((c) => c.id !== id) });
      notify(`Deleted ${name}. Sets you logged with it stay in your history.`);
    }
  };

  return (
    <div className="stack">
      <div className="page-head">
        <h1 className="title">Exercises</h1>
        <div className="row-gap">
          <button className="btn btn-ghost" onClick={() => setMachines(true)}>
            <IconStack /> Machine stickers
          </button>
          <button className="btn btn-glass" onClick={() => setCreating(true)}>
            Add your own
          </button>
        </div>
      </div>
      <MachinesDialog open={machines} onClose={() => setMachines(false)} />

      <div className="library">
        <aside className="glass panel library-map">
          <BodyMap
            label="Choose muscles to filter exercises"
            selected={sel}
            onToggle={toggle}
            describe={(m) => `${counts[m] ?? 0} exercises`}
            hint={sel.size ? `${[...sel].map((m) => MUSCLE_LABEL[m]).join(", ")}` : "Tap a muscle to see its exercises."}
          />
        </aside>

        <div className="stack">
          <div className="filters">
            <label className="search">
              <IconSearch />
              <input type="search" placeholder="Search by name or muscle" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search exercises" />
            </label>
            <select value={equipment} onChange={(e) => setEquipment(e.target.value)} aria-label="Equipment">
              <option value="">Any equipment</option>
              {equipmentList.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>
          <MuscleChips selected={sel} onToggle={toggle} onClear={() => setSel(new Set())} />

          <ul className="ex-grid">
            {list.map((e) => (
              <li key={e.id} className="glass ex-card swap-host">
                <button className="ex-card-main" onClick={() => openGuide(e.id)}>
                  <ExerciseThumb ex={e} size={132} swap />
                  <span className="ex-card-name">{e.name}</span>
                  <span className="meta">
                    <span className="tag">{e.equipment}</span>
                    <span className="muted small">{e.primary.map((m) => MUSCLE_LABEL[m]).join(", ")}</span>
                  </span>
                </button>
                {e.custom && (
                  <button className="icon-btn ex-card-del" onClick={() => removeCustom(e.id, e.name)} aria-label={`Delete ${e.name}`}>
                    <IconTrash />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {!list.length && (
            <section className="glass panel empty-panel">
              <p>No exercises match. Clear the search, choose other muscles, or add your own.</p>
            </section>
          )}
          <p className="credit">
            <a href={IMAGE_CREDIT.href} target="_blank" rel="noopener noreferrer">
              {IMAGE_CREDIT.text}
            </a>
          </p>
        </div>
      </div>

      <CustomExerciseDialog open={creating} onClose={() => setCreating(false)} equipmentList={equipmentList} />
    </div>
  );
}

function CustomExerciseDialog({ open, onClose, equipmentList }: { open: boolean; onClose: () => void; equipmentList: string[] }) {
  const { setData, attempt, notify, openGuide } = useApp();
  const [name, setName] = useState("");
  const [primary, setPrimary] = useState<Muscle>("chest");
  const [secondary, setSecondary] = useState<Set<Muscle>>(new Set());
  const [equipment, setEquipment] = useState("");
  const [measure, setMeasure] = useState<Measure>("weight");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) return notify("Give the exercise a name.");
    setBusy(true);
    const created = await attempt(() =>
      api.createExercise({ name: name.trim(), primary: [primary], secondary: [...secondary].filter((m) => m !== primary), equipment: equipment.trim(), measure })
    );
    setBusy(false);
    if (created) {
      setData((d) => d && { ...d, customExercises: [...d.customExercises, created] });
      setName("");
      setSecondary(new Set());
      onClose();
      openGuide(created.id);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add your own exercise"
      size="md"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-chalk" onClick={save} disabled={busy}>
            Save exercise
          </button>
        </>
      }
    >
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label>
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Landmine press" autoFocus />
        </label>
        <label>
          <span>Main muscle</span>
          <select value={primary} onChange={(e) => setPrimary(e.target.value as Muscle)}>
            {MUSCLES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend>Also works</legend>
          <div className="chips">
            {MUSCLES.filter((m) => m.id !== primary).map((m) => (
              <button
                type="button"
                key={m.id}
                className={`chip${secondary.has(m.id) ? " on" : ""}`}
                aria-pressed={secondary.has(m.id)}
                onClick={() => {
                  const n = new Set(secondary);
                  if (n.has(m.id)) n.delete(m.id);
                  else n.add(m.id);
                  setSecondary(n);
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </fieldset>
        <label>
          <span>Equipment</span>
          <input value={equipment} onChange={(e) => setEquipment(e.target.value)} list="equipment-list" maxLength={40} placeholder="Barbell, Cable, Machine…" />
          <datalist id="equipment-list">
            {equipmentList.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </label>
        <fieldset>
          <legend>Log it as</legend>
          <div className="seg seg-wide" role="radiogroup" aria-label="Log it as">
            {([
              ["weight", "Weight and reps"],
              ["bodyweight", "Bodyweight reps"],
              ["time", "Seconds"],
            ] as [Measure, string][]).map(([v, l]) => (
              <button type="button" key={v} role="radio" aria-checked={measure === v} className={measure === v ? "on" : ""} onClick={() => setMeasure(v)}>
                {l}
              </button>
            ))}
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
