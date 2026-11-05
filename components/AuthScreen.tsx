"use client";

import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";

type Mode = "setup" | "login" | "signup";

const COPY: Record<Mode, { title: string; intro: string; button: string }> = {
  setup: {
    title: "Set up Liftlog",
    intro: "Create the first account. It becomes the admin, who adds other people and manages their accounts.",
    button: "Create admin account",
  },
  login: { title: "Sign in", intro: "", button: "Sign in" },
  signup: { title: "Create an account", intro: "Your routines and workouts stay private to your account.", button: "Create account" },
};

export default function AuthScreen({ mode: initial, signupOpen, hasData }: { mode: "setup" | "login"; signupOpen?: boolean; hasData?: boolean }) {
  const [mode, setMode] = useState<Mode>(initial);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const creating = mode !== "login";
  const c = COPY[mode];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (creating && password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    try {
      if (mode === "setup") await api.auth.setup(username, password);
      else if (mode === "signup") await api.auth.signup(username, password);
      else await api.auth.login(username, password);
      window.location.reload();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const switchTo = (m: Mode) => {
    setMode(m);
    setError(null);
    setPassword("");
    setConfirm("");
  };

  return (
    <div className="auth">
      <div className="backdrop" />
      <main className="glass auth-card">
        <p className="wordmark auth-mark">
          <svg viewBox="0 0 28 16" width="28" height="16" aria-hidden="true">
            <rect x="1" y="3" width="4" height="10" rx="1.5" />
            <rect x="6" y="1" width="3" height="14" rx="1.2" />
            <rect x="9" y="7" width="10" height="2" />
            <rect x="19" y="1" width="3" height="14" rx="1.2" />
            <rect x="23" y="3" width="4" height="10" rx="1.5" />
          </svg>
          Liftlog
        </p>
        <h1 className="title">{c.title}</h1>
        {c.intro && <p className="muted">{c.intro}</p>}
        {mode === "setup" && hasData && (
          <p className="auth-note">Workouts and routines already in this database will belong to this account.</p>
        )}

        <form className="form" onSubmit={submit} noValidate>
          <label>
            <span>Username</span>
            <input
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              maxLength={32}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </label>
          <label>
            <span>Password</span>
            <input
              name="password"
              type="password"
              autoComplete={creating ? "new-password" : "current-password"}
              required
              minLength={creating ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {creating && (
            <label>
              <span>Password again</span>
              <input name="confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </label>
          )}
          {creating && <p className="muted small">At least 8 characters. Usernames use letters, numbers, dots, dashes or underscores.</p>}
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn-chalk" type="submit" disabled={busy || !username || !password}>
            {busy ? "One moment…" : c.button}
          </button>
        </form>

        {mode === "login" && signupOpen && (
          <p className="muted auth-switch">
            New here?{" "}
            <button className="link-btn" onClick={() => switchTo("signup")}>
              Create an account
            </button>
          </p>
        )}
        {mode === "signup" && (
          <p className="muted auth-switch">
            Already have an account?{" "}
            <button className="link-btn" onClick={() => switchTo("login")}>
              Sign in
            </button>
          </p>
        )}
        {mode === "login" && !signupOpen && <p className="muted small auth-switch">No account? Ask the admin to add you.</p>}
      </main>
    </div>
  );
}
