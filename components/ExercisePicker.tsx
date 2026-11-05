"use client";

import { useMemo, useState } from "react";
import type { Exercise } from "@/lib/exercises";
import { MUSCLES, MUSCLE_LABEL, type Muscle } from "@/lib/muscles";
import { useApp } from "./AppContext";
import { ExerciseThumb } from "./ExerciseArt";
import { IconCheck, IconInfo, IconPlus, IconSearch } from "./Icons";

export function filterExercises(all: Exercise[], q: string, muscles: ReadonlySet<Muscle>, equipment = "") {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return all.filter((e) => {
    if (muscles.size && !e.primary.some((m) => muscles.has(m))) return false;
    if (equipment && e.equipment !== equipment) return false;
    if (!words.length) return true;
    const hay = `${e.name} ${e.equipment} ${e.aliases?.join(" ") ?? ""} ${[...e.primary, ...e.secondary].map((m) => MUSCLE_LABEL[m]).join(" ")}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

export function MuscleChips({
  selected,
  onToggle,
  onClear,
  cardio,
}: {
  selected: ReadonlySet<Muscle>;
  onToggle: (m: Muscle) => void;
  onClear: () => void;
  /** Adds a Cardio chip that shows only the cardio machines */
  cardio?: { on: boolean; toggle: () => void };
}) {
  const all = selected.size === 0 && !cardio?.on;
  return (
    <div className="chips" role="group" aria-label="Filter by muscle">
      <button className={`chip${all ? " on" : ""}`} aria-pressed={all} onClick={onClear}>
        All
      </button>
      {cardio && (
        <button className={`chip${cardio.on ? " on" : ""}`} aria-pressed={cardio.on} onClick={cardio.toggle}>
          Cardio
        </button>
      )}
      {MUSCLES.map((m) => (
        <button key={m.id} className={`chip${selected.has(m.id) ? " on" : ""}`} aria-pressed={selected.has(m.id)} onClick={() => onToggle(m.id)}>
          {m.label}
        </button>
      ))}
    </div>
  );
}

type Props = {
  onPick: (ex: Exercise) => void;
  isAdded: (id: string) => boolean;
  /** Controlled muscle filter (e.g. driven by a body map); uncontrolled when omitted */
  muscles?: ReadonlySet<Muscle>;
  onMusclesChange?: (next: Set<Muscle>) => void;
  showChips?: boolean;
  autoFocus?: boolean;
};

/** Searchable exercise list with an add button per row. */
export default function ExercisePicker({ onPick, isAdded, muscles, onMusclesChange, showChips = true, autoFocus }: Props) {
  const { catalog, openGuide } = useApp();
  const [q, setQ] = useState("");
  const [own, setOwn] = useState<Set<Muscle>>(new Set());
  const [cardioOnly, setCardioOnly] = useState(false);
  const sel = muscles ?? own;
  const setSel = onMusclesChange ?? setOwn;

  // A muscle picked (here or on the body map) replaces the Cardio filter, and the other way round
  const cardio = cardioOnly && sel.size === 0;
  const list = useMemo(
    () => (cardio ? filterExercises(catalog.all, q, new Set()).filter((e) => e.measure === "cardio") : filterExercises(catalog.all, q, sel)),
    [catalog.all, q, sel, cardio]
  );

  const toggle = (m: Muscle) => {
    const next = new Set(sel);
    if (next.has(m)) next.delete(m);
    else next.add(m);
    setCardioOnly(false);
    setSel(next);
  };
  const toggleCardio = () => {
    if (!cardio) setSel(new Set());
    setCardioOnly(!cardio);
  };

  return (
    <div className="picker">
      <label className="search">
        <IconSearch />
        <input
          type="search"
          placeholder="Search exercises"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search exercises"
          autoFocus={autoFocus}
        />
      </label>
      {showChips && (
        <MuscleChips
          selected={sel}
          onToggle={toggle}
          onClear={() => {
            setCardioOnly(false);
            setSel(new Set());
          }}
          cardio={{ on: cardio, toggle: toggleCardio }}
        />
      )}
      <p className="picker-count muted">
        {list.length} {cardio ? (list.length === 1 ? "cardio machine" : "cardio machines") : list.length === 1 ? "exercise" : "exercises"}
        {!cardio && sel.size ? ` for ${[...sel].map((m) => MUSCLE_LABEL[m].toLowerCase()).join(", ")}` : ""}
      </p>
      <ul className="picker-list">
        {list.map((e) => {
          const added = isAdded(e.id);
          return (
            <li key={e.id} className="picker-row swap-host">
              <ExerciseThumb ex={e} size={52} swap />
              <div className="picker-text">
                <button className="link-btn" onClick={() => openGuide(e.id)}>
                  {e.name}
                </button>
                <span className="meta">
                  <span className="tag">{e.equipment}</span>
                  <span className="muted">{e.primary.map((m) => MUSCLE_LABEL[m]).join(", ")}</span>
                </span>
              </div>
              <button className="icon-btn" onClick={() => openGuide(e.id)} aria-label={`How to do ${e.name}`}>
                <IconInfo />
              </button>
              <button
                className={`icon-btn add${added ? " added" : ""}`}
                onClick={() => !added && onPick(e)}
                aria-label={added ? `${e.name} added` : `Add ${e.name}`}
                disabled={added}
              >
                {added ? <IconCheck /> : <IconPlus />}
              </button>
            </li>
          );
        })}
        {!list.length && <li className="empty">No exercises match. Clear the search or pick another muscle.</li>}
      </ul>
    </div>
  );
}
