"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useApp } from "./AppContext";
import { IconEdit, IconNote } from "./Icons";

/**
 * Your standing note for an exercise ("rack 7, pins 4", "seat on 3"). One per
 * exercise per account; it shows every time the exercise is in a workout.
 * Shown when there's a note or while editing; `editing` is controlled so a header
 * button can open it.
 */
export default function SetupNote({
  exerciseId,
  name,
  editing,
  setEditing,
}: {
  exerciseId: string;
  name: string;
  editing: boolean;
  setEditing: (v: boolean) => void;
}) {
  const { data, setData, attempt } = useApp();
  const note = data.exercisePrefs[exerciseId]?.note ?? "";
  const [text, setText] = useState(note);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      setText(note);
      requestAnimationFrame(() => {
        const t = ref.current;
        if (!t) return;
        t.focus();
        t.setSelectionRange(t.value.length, t.value.length);
      });
    }
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    setEditing(false);
    const next = text.trim();
    if (next === note) return;
    setData((d) => {
      if (!d) return d;
      const cur = d.exercisePrefs[exerciseId] ?? { note: "", machineId: null };
      return { ...d, exercisePrefs: { ...d.exercisePrefs, [exerciseId]: { ...cur, note: next } } };
    });
    void attempt(() => api.saveExercisePref(exerciseId, { note: next }));
  };

  if (editing)
    return (
      <div className="setup-note editing">
        <IconNote aria-hidden="true" />
        <textarea
          ref={ref}
          value={text}
          rows={2}
          maxLength={500}
          placeholder="Rack height, pin height, seat setting, grip…"
          aria-label={`Setup note for ${name}`}
          onChange={(e) => setText(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setText(note);
              setEditing(false);
            }
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
          }}
        />
      </div>
    );
  if (!note) return null;
  return (
    <button className="setup-note" onClick={() => setEditing(true)} aria-label={`Setup note for ${name}: ${note}. Edit`}>
      <IconNote aria-hidden="true" />
      <span>{note}</span>
      <IconEdit className="setup-note-edit" aria-hidden="true" />
    </button>
  );
}
