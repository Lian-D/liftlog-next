"use client";

import { useEffect, useMemo, useState, type SVGProps } from "react";
import { api, type ActivityBody } from "@/lib/api";
import { EFFORT_LABEL, SPORTS, SPORT_BY_ID, activityStats, type Sport, type SportField } from "@/lib/sports";
import { formatLong, pacificDate, pacificTime, pacificToEpoch } from "@/lib/time";
import type { Activity, DistUnit } from "@/lib/types";
import { elevUnit, fmtClockSec, fromDist, fromElev, toDist, toElev } from "@/lib/units";
import { useApp } from "./AppContext";
import { DurationInput, NumInput } from "./ExerciseBlock";
import Modal from "./Modal";

// ---------- icons ----------

const PATHS: Record<Sport, React.ReactNode> = {
  running: (
    <>
      <circle cx="15.5" cy="4.5" r="2" />
      <path d="M7 21l3.5-6.5 3 2.5 1 4M10.5 14.5l1.8-5.3-3.8 1.3-2 3M12.3 9.2l2.9 3.1 3.3-.8" />
    </>
  ),
  hiking: <path d="M2.5 20l6.5-11 4 6.5 2.5-3.5 6 8zM9 9l1.5 2.5" />,
  badminton: <path d="M12 21.5a2.6 2.6 0 0 0 2.6-2.6V17H9.4v1.9a2.6 2.6 0 0 0 2.6 2.6zM9.4 17L6.2 3.5M14.6 17l3.2-13.5M12 17V3M7.4 9h9.2M8.4 13h7.2" />,
  pickleball: (
    <>
      <path d="M13.8 4.2a5.5 5.5 0 0 1 0 7.8l-3.4 3.4-5.8-5.8L8 6.2a5.5 5.5 0 0 1 5.8-2zM7.5 12.5l-4.5 4.5 2 2 4.5-4.5" />
      <circle cx="18.5" cy="17.5" r="2.3" />
    </>
  ),
  golf: <path d="M9 21V3l8 3.6L9 10.2M4.5 21h10M9 21c-2.5 0-4.5-.5-4.5-1.2" />,
};

export function SportIcon({ sport, ...p }: { sport: Sport } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
      {PATHS[sport]}
    </svg>
  );
}

/** The "Log a sport" row on Train */
export function SportRow() {
  const { openActivity } = useApp();
  return (
    <div className="sport-row" role="group" aria-label="Log a sport">
      <span className="sport-row-label">Log a sport</span>
      <div className="sport-chips">
        {SPORTS.map((s) => (
          <button key={s.id} className="chip sport-chip" onClick={() => openActivity({ sport: s.id })}>
            <SportIcon sport={s.id} /> {s.short}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- the dialog: view one, or log/edit one ----------

type Draft = {
  sport: Sport;
  date: string;
  time: string;
  durationSec: number | null;
  /** In the display unit */
  distance: number | undefined;
  /** Elevation is held in the display unit (m or ft) while editing */
  data: Record<string, string | number>;
  notes: string;
};

const roundDown5 = (t: number) => Math.floor(t / 300_000) * 300_000;

function newDraft(sport: Sport, date: string | undefined): Draft {
  const def: Record<string, string | number> = sport === "golf" ? { holes: "18", mode: "walked" } : sport === "badminton" || sport === "pickleball" ? { format: "doubles" } : {};
  const base = { sport, durationSec: null, distance: undefined, data: def, notes: "" };
  if (date && date !== pacificDate()) return { ...base, date, time: "18:00" };
  // Logged today: assume it just ended
  const start = roundDown5(Date.now() - SPORT_BY_ID[sport].typicalMin * 60_000);
  return { ...base, date: pacificDate(start), time: pacificTime(start) };
}

function fromActivity(a: Activity, u: DistUnit): Draft {
  const data = { ...a.data };
  if (typeof data.elev === "number") data.elev = Math.round(toElev(data.elev, u));
  return {
    sport: a.sport,
    date: a.date,
    time: pacificTime(a.startedAt),
    durationSec: a.durationSec || null,
    distance: a.distanceKm != null ? Math.round(toDist(a.distanceKm, u) * 100) / 100 : undefined,
    data,
    notes: a.notes,
  };
}

function toBody(d: Draft, u: DistUnit): ActivityBody {
  const def = SPORT_BY_ID[d.sport];
  const keep = new Set(def.fields.map((f) => f.key));
  const data: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(d.data)) if (keep.has(k) && v !== "" && v != null) data[k] = v;
  if (typeof data.elev === "number") data.elev = Math.round(fromElev(data.elev, u));
  return {
    sport: d.sport,
    startedAt: pacificToEpoch(d.date, d.time),
    durationSec: d.durationSec ?? 0,
    distanceKm: def.distance && d.distance ? fromDist(d.distance, u) : null,
    data,
    notes: d.notes.trim(),
  };
}

export function ActivityDialog({ target, onClose }: { target: { id: string } | { sport: Sport; date?: string } | null; onClose: () => void }) {
  const { data, setData, attempt, notify } = useApp();
  const u = data.settings.distanceUnit;
  const existing = target && "id" in target ? data.activities.find((a) => a.id === target.id) ?? null : null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setConfirmDelete(false);
    if (!target) return setDraft(null);
    if ("id" in target) {
      setEditing(false);
      setDraft(existing ? fromActivity(existing, u) : null);
    } else {
      setEditing(true);
      setDraft(newDraft(target.sport, target.date));
    }
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  const def = draft ? SPORT_BY_ID[draft.sport] : null;
  const preview = useMemo(() => {
    if (!draft) return [];
    const b = toBody(draft, u);
    return activityStats({ ...b, id: "", date: draft.date, createdAt: 0 }, u);
  }, [draft, u]);

  if (!target) return <Modal open={false} onClose={onClose} title="">{null}</Modal>;

  const setUnit = (next: DistUnit) => {
    if (!draft || next === u) return;
    // Keep the same real distance and climb when switching units
    const km = draft.distance != null ? fromDist(draft.distance, u) : undefined;
    const elevM = typeof draft.data.elev === "number" ? fromElev(draft.data.elev, u) : undefined;
    setDraft({
      ...draft,
      distance: km != null ? Math.round(toDist(km, next) * 100) / 100 : undefined,
      data: { ...draft.data, ...(elevM != null ? { elev: Math.round(toElev(elevM, next)) } : {}) },
    });
    setData((d) => d && { ...d, settings: { ...d.settings, distanceUnit: next } });
    void attempt(() => api.saveSettings({ distanceUnit: next }));
  };

  const today = pacificDate();
  const startAt = draft ? pacificToEpoch(draft.date, draft.time) : 0;
  const problem = !draft
    ? ""
    : !draft.date || !draft.time
      ? "Pick a day and start time."
      : startAt > Date.now() + 60_000
        ? "That start time hasn't happened yet."
        : !draft.durationSec && !def?.durationOptional
          ? "How long did it take?"
          : "";

  const save = async () => {
    if (!draft || problem) return;
    setBusy(true);
    const body = toBody(draft, u);
    const saved = await attempt(() => (existing ? api.activities.update(existing.id, body) : api.activities.create(body)));
    setBusy(false);
    if (!saved) return;
    setData((d) => d && { ...d, activities: [...d.activities.filter((a) => a.id !== saved.id), saved].sort((a, b) => a.startedAt - b.startedAt) });
    notify(`${SPORT_BY_ID[saved.sport].name} ${existing ? "updated" : "saved"} for ${formatLong(saved.date)}.`);
    onClose();
  };

  const remove = async () => {
    if (!existing) return;
    setBusy(true);
    const ok = await attempt(() => api.activities.remove(existing.id));
    setBusy(false);
    if (!ok) return;
    setData((d) => d && { ...d, activities: d.activities.filter((a) => a.id !== existing.id) });
    notify(`Deleted the ${SPORT_BY_ID[existing.sport].name.toLowerCase()} from ${formatLong(existing.date)}.`);
    onClose();
  };

  // ----- view -----
  if (existing && !editing) {
    const stats = activityStats(existing, u);
    const choice = (k: string) => {
      const f = SPORT_BY_ID[existing.sport].fields.find((x) => x.key === k);
      return f?.kind === "choice" ? f.options.find((o) => o.v === existing.data[k])?.label : undefined;
    };
    const tags = SPORT_BY_ID[existing.sport].fields.filter((f) => f.kind === "choice" && existing.data[f.key] && f.key !== "holes").map((f) => choice(f.key));
    return (
      <Modal
        open
        onClose={onClose}
        title={
          <span className="act-title">
            <SportIcon sport={existing.sport} /> {SPORT_BY_ID[existing.sport].name}
          </span>
        }
        size="md"
        footer={
          confirmDelete ? (
            <>
              <span className="muted small">Delete this for good?</span>
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
                Keep it
              </button>
              <button className="btn btn-danger" onClick={remove} disabled={busy}>
                Delete
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost danger wk-delete" onClick={() => setConfirmDelete(true)}>
                Delete
              </button>
              <button className="btn btn-chalk" onClick={() => setEditing(true)}>
                Edit
              </button>
            </>
          )
        }
      >
        <div className="act-view">
          <p className="wk-when">
            {formatLong(existing.date)}, {new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit" }).format(existing.startedAt)}
            {existing.data.place ? ` · ${existing.data.place}` : ""}
          </p>
          {tags.length > 0 && (
            <p className="act-tags">
              {tags.map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </p>
          )}
          <dl className="wk-stats act-stats">
            {stats.map((st) => (
              <div key={st.label}>
                <dt>{st.label}</dt>
                <dd className="num">{st.value}</dd>
                {st.hint && <dd className="muted small">{st.hint}</dd>}
              </div>
            ))}
          </dl>
          {existing.notes && <blockquote className="wk-notes">{existing.notes}</blockquote>}
        </div>
      </Modal>
    );
  }

  // ----- log / edit -----
  if (!draft || !def) return <Modal open={false} onClose={onClose} title="">{null}</Modal>;
  const set = (k: string, v: string | number | undefined) => {
    const next = { ...draft.data };
    if (v == null || v === "") delete next[k];
    else next[k] = v;
    // Par follows the number of holes until you type your own
    if (k === "holes" && (draft.data.par == null || draft.data.par === (draft.data.holes === "9" ? 36 : 72))) delete next.par;
    setDraft({ ...draft, data: next });
  };

  const field = (f: SportField) => {
    const v = draft.data[f.key];
    const id = `act-${f.key}`;
    if (f.kind === "choice")
      return (
        <div className="field wide" key={f.key}>
          <span id={id}>{f.label}</span>
          <div className="chips" role="radiogroup" aria-labelledby={id}>
            {f.options.map((o) => (
              <button key={o.v} type="button" role="radio" aria-checked={v === o.v} className={`chip${v === o.v ? " on" : ""}`} onClick={() => set(f.key, v === o.v ? undefined : o.v)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      );
    if (f.kind === "text")
      return (
        <label className="field" key={f.key}>
          <span>{f.label}</span>
          <input value={(v as string) ?? ""} maxLength={80} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />
        </label>
      );
    if (f.kind === "effort")
      return (
        <label className="field" key={f.key}>
          <span>{f.label}</span>
          <select className="select" value={v ?? ""} onChange={(e) => set(f.key, e.target.value ? Number(e.target.value) : undefined)}>
            <option value="">Not rated</option>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}: {EFFORT_LABEL[n]}
              </option>
            ))}
          </select>
        </label>
      );
    const unitLabel = f.kind === "hr" ? "bpm" : f.kind === "elev" ? elevUnit(u) : "";
    const ph =
      f.key === "par" ? (draft.data.holes === "9" ? "36" : "72") : f.key === "fairwaysOf" ? (draft.data.holes === "9" ? "7" : "14") : f.kind === "int" ? f.placeholder ?? "" : "";
    return (
      <label className="field" key={f.key}>
        <span>
          {f.label}
          {unitLabel && <small className="muted"> ({unitLabel})</small>}
        </span>
        <NumInput value={typeof v === "number" ? v : undefined} placeholder={ph} label={f.label} onChange={(n) => set(f.key, n == null ? undefined : Math.round(n))} />
      </label>
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={existing ? `Edit ${def.name.toLowerCase()}` : `Log ${def.name.toLowerCase()}`}
      size="md"
      footer={
        <>
          {problem && <span className="muted small form-problem">{problem}</span>}
          <button className="btn btn-ghost" onClick={() => (existing ? setEditing(false) : onClose())}>
            Cancel
          </button>
          <button className="btn btn-chalk" onClick={save} disabled={busy || !!problem}>
            Save
          </button>
        </>
      }
    >
      <form
        className="act-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {!existing && (
          <div className="sport-chips wrap" role="radiogroup" aria-label="Sport">
            {SPORTS.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={draft.sport === s.id}
                className={`chip sport-chip${draft.sport === s.id ? " on" : ""}`}
                onClick={() => setDraft({ ...newDraft(s.id, draft.date), notes: draft.notes })}
              >
                <SportIcon sport={s.id} /> {s.short}
              </button>
            ))}
          </div>
        )}
        <div className="form-grid">
          <label className="field">
            <span>Day</span>
            <input type="date" value={draft.date} max={today} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
          </label>
          <label className="field">
            <span>Started</span>
            <input type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} />
          </label>
          <label className="field">
            <span>
              Time{def.durationOptional && <small className="muted"> (optional)</small>}
            </span>
            <DurationInput
              sec={draft.durationSec}
              placeholder={def.typicalMin >= 60 ? fmtClockSec(def.typicalMin * 60) : `${def.typicalMin}:00`}
              label="How long, as h:mm:ss, mm:ss or minutes"
              onChange={(sec) => setDraft({ ...draft, durationSec: sec })}
            />
          </label>
          {def.distance && (
            <div className="field">
              <span>Distance</span>
              <div className="dist-row">
                <NumInput value={draft.distance} placeholder={draft.sport === "hiking" ? "8" : "5"} label={`Distance in ${u}`} onChange={(v) => setDraft({ ...draft, distance: v })} />
                <div className="seg" role="radiogroup" aria-label="Distance unit">
                  {(["km", "mi"] as DistUnit[]).map((x) => (
                    <button key={x} type="button" role="radio" aria-checked={u === x} className={u === x ? "on" : ""} onClick={() => setUnit(x)}>
                      {x}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {def.fields.map(field)}
        </div>
        <label className="field">
          <span>Notes</span>
          <textarea rows={2} maxLength={2000} value={draft.notes} placeholder="Anything worth remembering" onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
        </label>
        {preview.length > 0 && (
          <div className="act-preview" aria-live="polite">
            {preview.map((p) => (
              <span key={p.label}>
                <small>{p.label}</small> <strong className="num">{p.value}</strong>
              </span>
            ))}
          </div>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
