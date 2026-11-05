"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { formatRelative, pacificDate } from "@/lib/time";
import type { UserSummary } from "@/lib/types";
import { useApp } from "./AppContext";
import { IconMore } from "./Icons";
import Modal from "./Modal";

const initial = (name: string) => name.slice(0, 1).toUpperCase();

/** "today", "yesterday", "Tue", "Oct 12" */
function lastSeen(t: number, today: string) {
  const r = formatRelative(pacificDate(t), today);
  return r === "Today" || r === "Yesterday" ? r.toLowerCase() : r;
}

/** Avatar button in the top bar with the account actions. */
export function AccountMenu() {
  const { data, attempt } = useApp();
  const me = data.me;
  const ref = useRef<HTMLDetailsElement>(null);
  const [dialog, setDialog] = useState<null | "password" | "users">(null);
  const open = (d: "password" | "users") => {
    ref.current?.removeAttribute("open");
    setDialog(d);
  };

  const signOut = async () => {
    ref.current?.removeAttribute("open");
    if (await attempt(() => api.auth.logout())) window.location.reload();
  };

  return (
    <>
      <details className="menu account" ref={ref}>
        <summary className="account-btn" aria-label={`Account: ${me.username}`}>
          <span className="avatar" aria-hidden="true">
            {initial(me.username)}
          </span>
          <span className="account-name">{me.username}</span>
        </summary>
        <div className="menu-pop glass">
          <p className="menu-head">
            Signed in as <strong>{me.username}</strong>
            {me.isAdmin && <span className="tag">Admin</span>}
          </p>
          <button onClick={() => open("password")}>Change password</button>
          {me.isAdmin && <button onClick={() => open("users")}>Manage users</button>}
          <a href="/api/export" download onClick={() => ref.current?.removeAttribute("open")}>
            Download my data
          </a>
          <button onClick={signOut}>Sign out</button>
        </div>
      </details>
      <ChangePasswordDialog open={dialog === "password"} onClose={() => setDialog(null)} />
      {me.isAdmin && <UsersDialog open={dialog === "users"} onClose={() => setDialog(null)} />}
    </>
  );
}

function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { notify } = useApp();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setCurrent("");
      setNext("");
      setConfirm("");
      setError(null);
    }
  }, [open]);

  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    if (next !== confirm) return setError("The new passwords don't match.");
    setBusy(true);
    try {
      await api.changePassword(current, next);
      notify("Password changed. Your other devices were signed out.");
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change password"
      size="sm"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-chalk" onClick={() => save()} disabled={busy || !current || !next}>
            Change password
          </button>
        </>
      }
    >
      <form className="form" onSubmit={save}>
        <label>
          <span>Current password</span>
          <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus />
        </label>
        <label>
          <span>New password</span>
          <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </label>
        <label>
          <span>New password again</span>
          <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        <p className="muted small">At least 8 characters. Other devices signed in to this account will be signed out.</p>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function UsersDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, setData, attempt, notify } = useApp();
  const [users, setUsers] = useState<UserSummary[] | null>(null);
  const [name, setName] = useState("");
  const [pass, setPass] = useState("");
  const [makeAdmin, setMakeAdmin] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [resetFor, setResetFor] = useState<UserSummary | null>(null);
  const [deleteFor, setDeleteFor] = useState<UserSummary | null>(null);
  const today = pacificDate();

  const load = useCallback(async () => setUsers((await attempt(() => api.admin.users())) ?? []), [attempt]);
  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const signupOpen = !!data.signupOpen;
  const toggleSignup = async () => {
    const res = await attempt(() => api.admin.setSignupOpen(!signupOpen));
    if (res) setData((d) => d && { ...d, signupOpen: res.signupOpen });
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      setUsers(await api.admin.addUser(name.trim(), pass, makeAdmin));
      notify(`Added ${name.trim()}. Share the username and password with them; they can change the password after signing in.`);
      setName("");
      setPass("");
      setMakeAdmin(false);
    } catch (err) {
      setFormError((err as Error).message);
    }
  };

  const act = async (fn: () => Promise<UserSummary[]>, message: string) => {
    const res = await attempt(fn);
    if (res) {
      setUsers(res);
      notify(message);
    }
    return !!res;
  };

  return (
    <Modal open={open} onClose={onClose} title="Users" size="md">
      <div className="users">
        <label className="switch-row">
          <span>
            <strong>Let people create their own accounts</strong>
            <span className="muted small">When off, only an admin can add accounts. Turn it on just long enough for someone to sign up.</span>
          </span>
          <input type="checkbox" role="switch" className="switch" checked={signupOpen} onChange={toggleSignup} />
        </label>

        <ul className="user-list" aria-busy={!users}>
          {(users ?? []).map((u) => {
            const isMe = u.id === data.me.id;
            return (
              <li key={u.id}>
                <span className="avatar" aria-hidden="true">
                  {initial(u.username)}
                </span>
                <span className="user-text">
                  <span className="user-name">
                    {u.username}
                    {u.isAdmin && <span className="tag">Admin</span>}
                    {isMe && <span className="tag">You</span>}
                  </span>
                  <span className="muted small">
                    {u.workouts} {u.workouts === 1 ? "workout" : "workouts"},{" "}
                    {u.lastLoginAt ? `last signed in ${lastSeen(u.lastLoginAt, today)}` : "never signed in"}
                  </span>
                </span>
                {!isMe && (
                  <UserActions
                    user={u}
                    onToggleAdmin={() =>
                      act(() => api.admin.updateUser(u.id, { isAdmin: !u.isAdmin }), u.isAdmin ? `${u.username} is no longer an admin.` : `${u.username} is now an admin.`)
                    }
                    onReset={() => setResetFor(u)}
                    onDelete={() => setDeleteFor(u)}
                  />
                )}
              </li>
            );
          })}
        </ul>

        <form className="add-user" onSubmit={add}>
          <h3>Add an account</h3>
          <div className="add-user-fields">
            <label>
              <span>Username</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={32} autoCapitalize="none" spellCheck={false} autoComplete="off" />
            </label>
            <label>
              <span>Password</span>
              <input value={pass} onChange={(e) => setPass(e.target.value)} type="text" autoComplete="new-password" placeholder="At least 8 characters" />
            </label>
          </div>
          <label className="check-row">
            <input type="checkbox" checked={makeAdmin} onChange={(e) => setMakeAdmin(e.target.checked)} />
            <span>Admin (can manage users)</span>
          </label>
          {formError && (
            <p className="auth-error" role="alert">
              {formError}
            </p>
          )}
          <button className="btn btn-chalk" type="submit" disabled={!name.trim() || !pass}>
            Add account
          </button>
        </form>
      </div>

      <ResetPasswordDialog
        user={resetFor}
        onClose={() => setResetFor(null)}
        onSave={async (pw) => {
          if (resetFor && (await act(() => api.admin.updateUser(resetFor.id, { password: pw }), `New password set for ${resetFor.username}. They've been signed out everywhere.`)))
            setResetFor(null);
        }}
      />

      <Modal
        open={!!deleteFor}
        onClose={() => setDeleteFor(null)}
        title={`Delete ${deleteFor?.username ?? ""}?`}
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setDeleteFor(null)}>
              Keep account
            </button>
            <button
              className="btn btn-danger"
              onClick={async () => {
                if (deleteFor && (await act(() => api.admin.deleteUser(deleteFor.id), `Deleted ${deleteFor.username}.`))) setDeleteFor(null);
              }}
            >
              Delete account
            </button>
          </>
        }
      >
        <p>
          Their routines and {deleteFor?.workouts ?? 0} {deleteFor?.workouts === 1 ? "workout are" : "workouts are"} deleted with the account. This can&rsquo;t be undone.
        </p>
      </Modal>
    </Modal>
  );
}

function UserActions({ user, onToggleAdmin, onReset, onDelete }: { user: UserSummary; onToggleAdmin: () => void; onReset: () => void; onDelete: () => void }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const go = (fn: () => void) => () => {
    ref.current?.removeAttribute("open");
    fn();
  };
  return (
    <details className="menu" ref={ref}>
      <summary className="icon-btn" aria-label={`Options for ${user.username}`}>
        <IconMore />
      </summary>
      <div className="menu-pop glass">
        <button onClick={go(onToggleAdmin)}>{user.isAdmin ? "Remove admin" : "Make admin"}</button>
        <button onClick={go(onReset)}>Set a new password</button>
        <button className="danger" onClick={go(onDelete)}>
          Delete account
        </button>
      </div>
    </details>
  );
}

function ResetPasswordDialog({ user, onClose, onSave }: { user: UserSummary | null; onClose: () => void; onSave: (pw: string) => void }) {
  const [pw, setPw] = useState("");
  useEffect(() => setPw(""), [user]);
  return (
    <Modal
      open={!!user}
      onClose={onClose}
      title={`New password for ${user?.username ?? ""}`}
      size="sm"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-chalk" onClick={() => onSave(pw)} disabled={pw.length < 8}>
            Set password
          </button>
        </>
      }
    >
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (pw.length >= 8) onSave(pw);
        }}
      >
        <label>
          <span>New password</span>
          <input value={pw} onChange={(e) => setPw(e.target.value)} type="text" autoComplete="new-password" autoFocus />
        </label>
        <p className="muted small">At least 8 characters. They&rsquo;ll be signed out on every device and can change it after signing in.</p>
      </form>
    </Modal>
  );
}
