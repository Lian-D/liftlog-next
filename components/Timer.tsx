"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api, syncTimer } from "@/lib/api";
import { clearShownAlerts, disablePush, enablePush, pushState, pushSubscription, swRegistration, type PushState } from "@/lib/push";
import type { Settings } from "@/lib/types";
import { useApp } from "./AppContext";
import { IconBell, IconClose, IconPause, IconPlay, IconReset, IconTimer } from "./Icons";
import Modal from "./Modal";
import { REST_CHOICES, fmtRest } from "./RestSelect";

/*
 * One countdown timer for the whole app: the rest timer that starts when a set is
 * ticked, or any timer you set yourself. It lives in this browser (localStorage),
 * so it survives reloads and switching tabs, and it runs off an end time rather
 * than a counter, so a frozen page catches up the moment it's visible again.
 */

export type TimerKind = "rest" | "timer";
export type TimerState =
  | { status: "idle" }
  | { status: "running"; kind: TimerKind; endAt: number; totalMs: number; label: string }
  | { status: "paused"; kind: TimerKind; leftMs: number; totalMs: number; label: string }
  | { status: "done"; kind: TimerKind; endedAt: number; totalMs: number; label: string };

type PushInfo = { state: PushState | "checking"; busy: boolean; toggle: (on: boolean) => void; test: () => void };

type TimerCtx = {
  state: TimerState;
  start: (sec: number, opts?: { kind?: TimerKind; label?: string }) => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  add: (sec: number) => void;
  openSheet: () => void;
  push: PushInfo;
};

const TCtx = createContext<TimerCtx | null>(null);
export function useTimer() {
  const c = useContext(TCtx);
  if (!c) throw new Error("useTimer must be used inside <TimerProvider>");
  return c;
}

const KEY = "liftlog.timer.v1";
const MAX_MS = 99 * 60_000 + 59_000;
const PRESETS = [30, 45, 60, 90, 120, 180, 300, 600];

/** 1:05, 12:00 */
export const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const titleFor = (kind: TimerKind) => (kind === "rest" ? "Rest's over" : "Time's up");

// ---------- sound ----------

let audio: AudioContext | null = null;

/** Called from the tap that starts a timer: browsers only let a page make sound after the user has interacted. */
function unlockAudio() {
  try {
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    // Safari: a short alert that plays over music (ducking it) and isn't silenced like a game sound
    if (nav.audioSession) nav.audioSession.type = "transient";
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    audio ??= new AC();
    if (audio.state === "suspended") void audio.resume().catch(() => {});
    const blip = audio.createBufferSource();
    blip.buffer = audio.createBuffer(1, 1, 22050);
    blip.connect(audio.destination);
    blip.start(0);
  } catch {
    /* no sound available; the visual and vibration alerts still work */
  }
}

function beep() {
  if (!audio) unlockAudio();
  const ctx = audio;
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  const t0 = ctx.currentTime + 0.03;
  [0, 0.24, 0.48, 0.9, 1.14, 1.38].forEach((d, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = i % 3 === 2 ? 1318.5 : 987.8;
    g.gain.setValueAtTime(0.0001, t0 + d);
    g.gain.exponentialRampToValueAtTime(0.4, t0 + d + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.19);
    o.connect(g).connect(ctx.destination);
    o.start(t0 + d);
    o.stop(t0 + d + 0.21);
  });
}

function useNow(active: boolean, every = 250) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), every);
    return () => window.clearInterval(id);
  }, [active, every]);
  return now;
}

const leftOf = (s: TimerState, now: number) => (s.status === "running" ? s.endAt - now : s.status === "paused" ? s.leftMs : 0);

// ---------- provider ----------

export function TimerProvider({ children }: { children: ReactNode }) {
  const { data, notify } = useApp();
  const { timerSound, keepAwake } = data.settings;
  const [state, setState] = useState<TimerState>({ status: "idle" });
  const [sheet, setSheet] = useState(false);
  const stateRef = useRef(state);
  const restored = useRef(false);
  const endpoint = useRef<string | null>(null);
  const seq = useRef(0);
  const [push, setPush] = useState<PushState | "checking">("checking");
  const [pushBusy, setPushBusy] = useState(false);
  const pushRef = useRef(push);

  useEffect(() => {
    stateRef.current = state;
    pushRef.current = push;
  });

  // Save every change (declared before the restore below, so the first pass doesn't wipe what's saved).
  useEffect(() => {
    if (!restored.current) return;
    try {
      if (state.status === "idle") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* private mode: the timer still works for this page */
    }
  }, [state]);

  useEffect(() => {
    let saved: TimerState | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(KEY) || "null");
    } catch {
      saved = null;
    }
    if (saved?.status === "running" && saved.endAt <= Date.now())
      saved = { status: "done", kind: saved.kind, endedAt: saved.endAt, totalMs: saved.totalMs, label: saved.label };
    if (saved?.status === "done" && Date.now() - saved.endedAt > 60_000) saved = null;
    if (saved && typeof saved === "object" && "status" in saved) setState(saved);
    restored.current = true;

    // Another tab started or stopped the timer
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY) return;
      try {
        setState(e.newValue ? JSON.parse(e.newValue) : { status: "idle" });
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // ----- lock-screen alerts -----
  useEffect(() => {
    let off = false;
    (async () => {
      await swRegistration();
      const st = await pushState();
      if (off) return;
      setPush(st);
      if (st === "on") {
        const sub = await pushSubscription();
        endpoint.current = sub?.endpoint ?? null;
        // Re-register with the server, in case its database was replaced or someone else signed in here.
        if (sub) api.push.subscribe(sub.toJSON()).catch(() => {});
      }
    })();
    return () => {
      off = true;
    };
  }, []);

  /** Tell the server this browser's timer and whether the app is on screen. It sends the alert only when it isn't. */
  const sendState = useCallback(() => {
    const ep = endpoint.current;
    if (!ep || pushRef.current !== "on") return;
    const s = stateRef.current;
    seq.current = Math.max(seq.current + 1, Date.now());
    const hidden = document.visibilityState === "hidden";
    if (s.status === "running")
      syncTimer({
        endpoint: ep,
        endAt: s.endAt,
        title: titleFor(s.kind),
        label: s.label || (s.kind === "rest" ? "Time for your next set." : `Your ${fmtClock(s.totalMs)} timer has finished.`),
        hidden,
        seq: seq.current,
      });
    else syncTimer({ endpoint: ep, endAt: null, hidden, seq: seq.current });
  }, []);

  const lastSent = useRef("");
  useEffect(() => {
    const sig = state.status === "running" ? `r${state.endAt}${state.label}` : "x";
    if (sig === lastSent.current) return;
    lastSent.current = sig;
    if (push === "on") sendState();
  }, [state, push, sendState]);

  useEffect(() => {
    const onVis = () => {
      if (stateRef.current.status === "running") sendState();
      if (document.visibilityState === "visible") void clearShownAlerts();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [sendState]);

  const togglePush = useCallback(
    (on: boolean) => {
      setPushBusy(true);
      // enablePush asks for permission before its first await, so it still counts as part of this tap
      const job = on ? enablePush() : disablePush().then(() => null);
      job
        .then(async (ep) => {
          endpoint.current = ep;
          setPush(await pushState());
          if (ep) {
            notify("Lock-screen alerts are on for this device.");
            lastSent.current = "";
            sendState();
          }
        })
        .catch(async (e: Error) => {
          notify(e.message || "Couldn't turn on lock-screen alerts.");
          setPush(await pushState());
        })
        .finally(() => setPushBusy(false));
    },
    [notify, sendState]
  );

  const testPush = useCallback(() => {
    const ep = endpoint.current;
    if (!ep) return;
    api.push
      .test(ep)
      .then(() => notify("Test alert sent. Lock the phone to see how it looks next time."))
      .catch((e: Error) => notify(e.message));
  }, [notify]);

  // ----- running out -----
  const finish = useCallback(
    (s: Extract<TimerState, { status: "running" }>) => {
      const late = Date.now() - s.endAt;
      setState({ status: "done", kind: s.kind, endedAt: s.endAt, totalMs: s.totalMs, label: s.label });
      // Noticed only on coming back to the app: the lock-screen alert, if on, already went off.
      if (late > 4000) return;
      const onScreen = document.visibilityState === "visible";
      if (timerSound && (onScreen || pushRef.current !== "on")) beep();
      if (onScreen) navigator.vibrate?.([220, 120, 220, 120, 220]);
    },
    [timerSound]
  );

  useEffect(() => {
    if (state.status !== "running") return;
    const check = () => {
      if (Date.now() >= state.endAt) finish(state);
    };
    const id = window.setInterval(check, 250);
    document.addEventListener("visibilitychange", check);
    check();
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", check);
    };
  }, [state, finish]);

  // "Time's up" clears itself after a while
  useEffect(() => {
    if (state.status !== "done") return;
    const id = window.setTimeout(() => setState({ status: "idle" }), Math.max(4000, 30_000 - (Date.now() - state.endedAt)));
    return () => window.clearTimeout(id);
  }, [state]);

  // ----- keep the screen on while it runs -----
  const wantLock = state.status === "running" && keepAwake;
  useEffect(() => {
    if (!wantLock || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let dead = false;
    const get = async () => {
      if (document.visibilityState !== "visible" || (lock && !lock.released)) return;
      try {
        lock = await navigator.wakeLock.request("screen");
        if (dead) void lock.release();
      } catch {
        /* low battery mode or not allowed: carry on without */
      }
    };
    void get();
    document.addEventListener("visibilitychange", get);
    return () => {
      dead = true;
      document.removeEventListener("visibilitychange", get);
      void lock?.release().catch(() => {});
    };
  }, [wantLock]);

  // ----- controls -----
  const start = useCallback((sec: number, opts: { kind?: TimerKind; label?: string } = {}) => {
    unlockAudio();
    const ms = Math.min(MAX_MS, Math.max(1000, Math.round(sec) * 1000));
    setState({ status: "running", kind: opts.kind ?? "timer", endAt: Date.now() + ms, totalMs: ms, label: opts.label ?? "" });
  }, []);
  const pause = useCallback(() => {
    setState((s) => (s.status === "running" ? { status: "paused", kind: s.kind, leftMs: Math.max(0, s.endAt - Date.now()), totalMs: s.totalMs, label: s.label } : s));
  }, []);
  const resume = useCallback(() => {
    unlockAudio();
    setState((s) => (s.status === "paused" ? { status: "running", kind: s.kind, endAt: Date.now() + s.leftMs, totalMs: s.totalMs, label: s.label } : s));
  }, []);
  const reset = useCallback(() => setState({ status: "idle" }), []);
  const add = useCallback((sec: number) => {
    unlockAudio();
    setState((s) => {
      const d = sec * 1000;
      if (s.status === "running") {
        const left = Math.min(MAX_MS, s.endAt - Date.now() + d);
        if (left <= 0) return { status: "done", kind: s.kind, endedAt: Date.now(), totalMs: s.totalMs, label: s.label };
        return { ...s, endAt: Date.now() + left, totalMs: Math.max(s.totalMs + d, left) };
      }
      if (s.status === "paused") {
        const left = Math.min(MAX_MS, Math.max(1000, s.leftMs + d));
        return { ...s, leftMs: left, totalMs: Math.max(s.totalMs + d, left) };
      }
      if (s.status === "done" && d > 0) return { status: "running", kind: s.kind, endAt: Date.now() + d, totalMs: d, label: s.label };
      return s;
    });
  }, []);

  const ctx: TimerCtx = {
    state, start, pause, resume, reset, add,
    openSheet: () => setSheet(true),
    push: { state: push, busy: pushBusy, toggle: togglePush, test: testPush },
  };

  useEffect(() => {
    document.documentElement.dataset.timer = state.status === "idle" ? "" : "on";
  }, [state.status]);

  return (
    <TCtx.Provider value={ctx}>
      {children}
      <TimerPill />
      <TimerSheet open={sheet} onClose={() => setSheet(false)} />
    </TCtx.Provider>
  );
}

// ---------- pieces ----------

function Ring({ frac, size, stroke }: { frac: number; size: number; stroke: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const f = Math.min(1, Math.max(0, frac));
  return (
    <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
      <circle
        className="ring-fill"
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - f)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

/** Top-bar button that opens the timer. */
export function TimerButton() {
  const { state, openSheet } = useTimer();
  const on = state.status === "running" || state.status === "paused";
  return (
    <button className={`icon-btn timer-btn${on ? " on" : ""}`} onClick={openSheet} aria-label={on ? "Timer running. Open timer" : "Open timer"}>
      <IconTimer />
    </button>
  );
}

function TimerPill() {
  const { state, openSheet, add, reset, pause, resume } = useTimer();
  const now = useNow(state.status === "running");
  if (state.status === "idle") return null;
  const left = leftOf(state, now);
  const done = state.status === "done";
  return (
    <div className={`tpill ${state.status}`} role="timer" aria-live="off">
      <button className="tpill-main" onClick={openSheet} aria-label={`${done ? titleFor(state.kind) : `${fmtClock(left)} left`}. Open timer`}>
        <Ring frac={done ? 0 : left / state.totalMs} size={34} stroke={4} />
        <span className="tpill-text">
          <span className="tpill-time num">{done ? titleFor(state.kind) : fmtClock(left)}</span>
          {state.label && <span className="tpill-label">{state.label}</span>}
        </span>
      </button>
      {state.status === "running" && (
        <>
          <button className="tpill-btn" onClick={() => add(15)} aria-label="Add 15 seconds">
            +15
          </button>
          <button className="tpill-btn icon" onClick={pause} aria-label="Pause">
            <IconPause />
          </button>
        </>
      )}
      {state.status === "paused" && (
        <button className="tpill-btn icon" onClick={resume} aria-label="Resume">
          <IconPlay />
        </button>
      )}
      <button className="tpill-btn icon" onClick={reset} aria-label={done ? "Dismiss" : state.kind === "rest" ? "Skip rest" : "Stop timer"}>
        <IconClose />
      </button>
    </div>
  );
}

function TimerSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTimer();
  const { state } = t;
  const now = useNow(open && state.status === "running");
  const [min, setMin] = useState("2");
  const [sec, setSec] = useState("00");
  const customSec = Math.min(99, Number(min) || 0) * 60 + Math.min(59, Number(sec) || 0);
  const live = state.status === "running" || state.status === "paused";
  const left = leftOf(state, now);

  return (
    <Modal open={open} onClose={onClose} title="Timer" size="sm">
      <div className="tm">
        <div className={`tm-face ${state.status}`}>
          <Ring frac={live ? left / state.totalMs : state.status === "done" ? 0 : 1} size={208} stroke={9} />
          <div className="tm-read" role="timer" aria-live="off">
            <span className="tm-time num">{live ? fmtClock(left) : state.status === "done" ? "0:00" : fmtClock(customSec * 1000)}</span>
            <span className="tm-sub">
              {state.status === "paused" ? "Paused" : state.status === "done" ? titleFor(state.kind) : live ? state.label || (state.kind === "rest" ? "Resting" : "Running") : "Ready"}
            </span>
          </div>
        </div>

        {live ? (
          <>
            <div className="tm-controls">
              <button className="btn btn-glass" onClick={() => t.add(-15)} aria-label="Take off 15 seconds">
                −15 s
              </button>
              {state.status === "running" ? (
                <button className="btn btn-chalk tm-main" onClick={t.pause}>
                  <IconPause /> Pause
                </button>
              ) : (
                <button className="btn btn-chalk tm-main" onClick={t.resume}>
                  <IconPlay /> Resume
                </button>
              )}
              <button className="btn btn-glass" onClick={() => t.add(15)} aria-label="Add 15 seconds">
                +15 s
              </button>
            </div>
            <button className="btn btn-ghost tm-reset" onClick={t.reset}>
              <IconReset /> Reset
            </button>
          </>
        ) : (
          <>
            {state.status === "done" && (
              <div className="tm-controls">
                <button className="btn btn-chalk tm-main" onClick={() => t.start(state.totalMs / 1000, { kind: state.kind, label: state.kind === "rest" ? "" : state.label })}>
                  <IconReset /> Again ({fmtClock(state.totalMs)})
                </button>
              </div>
            )}
            <div className="tm-presets" role="group" aria-label="Start a timer">
              {PRESETS.map((s) => (
                <button key={s} className="chip" onClick={() => t.start(s)}>
                  {fmtRest(s)}
                </button>
              ))}
            </div>
            <form
              className="tm-custom"
              onSubmit={(e) => {
                e.preventDefault();
                if (customSec > 0) t.start(customSec);
              }}
            >
              <label className="sr-only" htmlFor="tm-min">
                Minutes
              </label>
              <input id="tm-min" className="num-input" inputMode="numeric" value={min} maxLength={2} onFocus={(e) => e.target.select()} onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))} />
              <span aria-hidden="true">:</span>
              <label className="sr-only" htmlFor="tm-sec">
                Seconds
              </label>
              <input
                id="tm-sec"
                className="num-input"
                inputMode="numeric"
                value={sec}
                maxLength={2}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setSec(e.target.value.replace(/\D/g, ""))}
                onBlur={() => setSec(String(Math.min(59, Number(sec) || 0)).padStart(2, "0"))}
              />
              <button className="btn btn-chalk" type="submit" disabled={customSec <= 0}>
                <IconPlay /> Start
              </button>
            </form>
          </>
        )}
      </div>
      <TimerSettings />
    </Modal>
  );
}

const PUSH_NOTE: Record<PushState | "checking", string> = {
  checking: "Checking what this browser supports…",
  on: "On for this device. You'll get a notification when time's up, even with the phone locked.",
  off: "Get a notification when time's up while the phone is locked or you're in another app.",
  insecure: "Needs Liftlog's HTTPS address. Browsers only allow these alerts on secure sites.",
  "ios-install": "On iPhone, add Liftlog to your Home Screen first (Share, then Add to Home Screen) and open it from there.",
  unsupported: "This browser doesn't support them.",
  denied: "Notifications are blocked for this site. Allow them in the browser's site settings, then come back.",
};

function TimerSettings() {
  const { data, setData, attempt } = useApp();
  const { push } = useTimer();
  const s = data.settings;
  const save = (patch: Partial<Settings>) => {
    setData((d) => d && { ...d, settings: { ...d.settings, ...patch } });
    void attempt(() => api.saveSettings(patch));
  };
  const canLock = typeof navigator !== "undefined" && "wakeLock" in navigator;
  const pushUsable = push.state === "on" || push.state === "off";

  return (
    <section className="tm-settings" aria-labelledby="tm-settings-h">
      <h3 id="tm-settings-h">Rest timer</h3>
      <label className="switch-row">
        <span>
          <strong>Start it when I tick a set</strong>
          <small className="muted">Uses the exercise&rsquo;s rest, then the routine&rsquo;s, then the default below.</small>
        </span>
        <input type="checkbox" className="switch" checked={s.restAuto} onChange={(e) => save({ restAuto: e.target.checked })} />
      </label>
      <label className="switch-row">
        <span>
          <strong>Default rest</strong>
          <small className="muted">Routines and single exercises can set their own.</small>
        </span>
        <select className="select" value={s.restSec} onChange={(e) => save({ restSec: Number(e.target.value) })}>
          {(REST_CHOICES.includes(s.restSec) ? REST_CHOICES : [...REST_CHOICES, s.restSec].sort((a, b) => a - b)).map((v) => (
            <option key={v} value={v}>
              {fmtRest(v)}
            </option>
          ))}
        </select>
      </label>
      <label className="switch-row">
        <span>
          <strong>Sound</strong>
          <small className="muted">Beep when time&rsquo;s up while Liftlog is open.</small>
        </span>
        <input type="checkbox" className="switch" checked={s.timerSound} onChange={(e) => save({ timerSound: e.target.checked })} />
      </label>
      <label className={`switch-row${canLock ? "" : " off"}`}>
        <span>
          <strong>Keep the screen on</strong>
          <small className="muted">{canLock ? "While a timer runs, so it stays in view." : "This browser can't keep the screen on (it needs HTTPS)."}</small>
        </span>
        <input type="checkbox" className="switch" checked={s.keepAwake && canLock} disabled={!canLock} onChange={(e) => save({ keepAwake: e.target.checked })} />
      </label>
      <label className={`switch-row${pushUsable ? "" : " off"}`}>
        <span>
          <strong>
            <IconBell className="inline-icon" /> Lock-screen alerts
          </strong>
          <small className="muted">{PUSH_NOTE[push.state]}</small>
          {push.state === "on" && (
            <button type="button" className="link-btn small" onClick={push.test}>
              Send a test alert
            </button>
          )}
        </span>
        <input
          type="checkbox"
          className="switch"
          checked={push.state === "on"}
          disabled={!pushUsable || push.busy}
          onChange={(e) => push.toggle(e.target.checked)}
        />
      </label>
    </section>
  );
}
