import "server-only";
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import type { Me, UserSummary } from "@/lib/types";

export const SESSION_COOKIE = "liftlog_session";
const SESSION_DAYS = 30;
const DAY = 86_400_000;

// ---------------- Passwords (scrypt) ----------------

const SCRYPT = { N: 2 ** 15, r: 8, p: 1, keylen: 64 };

function scryptAsync(password: string, salt: Buffer, keylen: number, opts: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key)))
  );
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const { N, r, p, keylen } = SCRYPT;
  const key = await scryptAsync(password, salt, keylen, { N, r, p, maxmem: 128 * N * r * 2 });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [alg, n, r, p, salt, key] = stored.split("$");
  if (alg !== "scrypt") return false;
  const expected = Buffer.from(key, "base64");
  const N = Number(n);
  const actual = await scryptAsync(password, Buffer.from(salt, "base64"), expected.length, {
    N, r: Number(r), p: Number(p), maxmem: 128 * N * Number(r) * 2,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Compared against when the username doesn't exist, so a miss takes as long as a wrong password. */
let dummyHash: Promise<string> | null = null;
export const burnTime = (password: string) => (dummyHash ??= hashPassword("not-a-real-password")).then((h) => verifyPassword(password, h));

// ---------------- Users ----------------

type UserRow = { id: string; username: string; password_hash: string; is_admin: number; created_at: number; last_login_at: number | null };

const toMe = (u: UserRow): Me => ({ id: u.id, username: u.username, isAdmin: !!u.is_admin });

export const userCount = () => (db().prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
export const adminCount = () => (db().prepare("SELECT COUNT(*) AS n FROM users WHERE is_admin = 1").get() as { n: number }).n;

export const findUserByName = (username: string) =>
  db().prepare("SELECT * FROM users WHERE username = ?").get(username) as UserRow | undefined;

export const findUser = (id: string) => db().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;

/** True when the database holds workouts or routines from before accounts existed. */
export function hasUnclaimedData() {
  const q = (t: string) => !!db().prepare(`SELECT 1 FROM ${t} WHERE user_id IS NULL LIMIT 1`).get();
  return q("sessions") || q("routines") || q("custom_exercises");
}

export class AuthError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export async function createUser(username: string, password: string, isAdmin: boolean): Promise<Me> {
  const hash = await hashPassword(password);
  const id = randomUUID();
  try {
    db().prepare("INSERT INTO users (id, username, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(id, username, hash, isAdmin ? 1 : 0, Date.now());
  } catch (e) {
    if (String((e as Error).message).includes("UNIQUE")) throw new AuthError("That username is taken.", 409);
    throw e;
  }
  return toMe(findUser(id)!);
}

/**
 * First-run setup: create the admin, and hand it everything stored before accounts
 * existed. Runs as one write transaction, so two people racing for it can't both win.
 */
export async function createFirstAdmin(username: string, password: string): Promise<Me> {
  const hash = await hashPassword(password);
  const id = randomUUID();
  const t = Date.now();
  const run = db().transaction(() => {
    if (userCount() > 0) throw new AuthError("Liftlog is already set up. Sign in instead.", 409);
    db().prepare("INSERT INTO users (id, username, password_hash, is_admin, created_at) VALUES (?, ?, ?, 1, ?)").run(id, username, hash, t);
    for (const table of ["routines", "sessions", "custom_exercises"])
      db().prepare(`UPDATE ${table} SET user_id = ? WHERE user_id IS NULL`).run(id);
    // Unit and rest-timer choices made before accounts become this user's
    db().prepare("INSERT OR IGNORE INTO user_settings (user_id, key, value) SELECT ?, key, value FROM settings WHERE key IN ('unit', 'restSec')").run(id);
  });
  run.immediate();
  return toMe(findUser(id)!);
}

export async function checkLogin(username: string, password: string): Promise<Me | null> {
  const u = findUserByName(username);
  if (!u) {
    await burnTime(password);
    return null;
  }
  if (!(await verifyPassword(password, u.password_hash))) return null;
  return toMe(u);
}

export async function setPassword(userId: string, password: string, keepToken?: string) {
  const hash = await hashPassword(password);
  db().transaction(() => {
    db().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, userId);
    // Sign out everywhere else
    if (keepToken) db().prepare("DELETE FROM auth_sessions WHERE user_id = ? AND token_hash != ?").run(userId, sha256(keepToken));
    else db().prepare("DELETE FROM auth_sessions WHERE user_id = ?").run(userId);
  })();
}

export function setAdmin(userId: string, isAdmin: boolean) {
  db().transaction(() => {
    const u = findUser(userId);
    if (!u) throw new AuthError("Account not found.", 404);
    if (!isAdmin && u.is_admin && adminCount() <= 1) throw new AuthError("There has to be at least one admin.", 409);
    db().prepare("UPDATE users SET is_admin = ? WHERE id = ?").run(isAdmin ? 1 : 0, userId);
  }).immediate();
}

/** Deletes the account and, through the foreign keys, its routines, workouts and exercises. */
export function deleteUser(userId: string) {
  db().transaction(() => {
    const u = findUser(userId);
    if (!u) throw new AuthError("Account not found.", 404);
    if (u.is_admin && adminCount() <= 1) throw new AuthError("There has to be at least one admin.", 409);
    db().prepare("DELETE FROM timer_alarms WHERE endpoint IN (SELECT endpoint FROM push_subscriptions WHERE user_id = ?)").run(userId);
    for (const table of ["push_subscriptions", "activities", "body_weights", "exercise_prefs", "machines", "sessions", "routines", "custom_exercises", "user_settings", "auth_sessions"])
      db().prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(userId);
    db().prepare("DELETE FROM users WHERE id = ?").run(userId);
  }).immediate();
}

export function listUsers(): UserSummary[] {
  return db()
    .prepare(
      `SELECT u.id, u.username, u.is_admin AS isAdmin, u.created_at AS createdAt, u.last_login_at AS lastLoginAt,
              (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id AND s.finished_at IS NOT NULL) AS workouts
       FROM users u ORDER BY u.created_at`
    )
    .all()
    .map((r) => ({ ...(r as UserSummary), isAdmin: !!(r as { isAdmin: number }).isAdmin }));
}

// ---------------- Sessions ----------------

const sha256 = (s: string) => createHash("sha256").update(s).digest("base64url");

/** Starts a session and returns the token for the cookie. Only its hash is stored. */
export function startAuthSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const t = Date.now();
  db().prepare("DELETE FROM auth_sessions WHERE expires_at < ?").run(t);
  db().prepare("INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .run(sha256(token), userId, t, t + SESSION_DAYS * DAY);
  db().prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(t, userId);
  return token;
}

export function endAuthSession(token: string) {
  db().prepare("DELETE FROM auth_sessions WHERE token_hash = ?").run(sha256(token));
}

/** The signed-in user for a token, or null. Sessions in their second half get extended. */
export function userForToken(token: string | undefined): { me: Me; renewed: boolean } | null {
  if (!token) return null;
  const row = db()
    .prepare("SELECT s.expires_at, u.* FROM auth_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?")
    .get(sha256(token)) as (UserRow & { expires_at: number }) | undefined;
  const t = Date.now();
  if (!row || row.expires_at < t) return null;
  let renewed = false;
  if (row.expires_at - t < (SESSION_DAYS / 2) * DAY) {
    db().prepare("UPDATE auth_sessions SET expires_at = ? WHERE token_hash = ?").run(t + SESSION_DAYS * DAY, sha256(token));
    renewed = true;
  }
  return { me: toMe(row), renewed };
}

/** For server components: who's signed in, from the request cookie. */
export async function currentUser(): Promise<Me | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return userForToken(token)?.me ?? null;
}

export const cookieOptions = (secure: boolean) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure,
  path: "/",
  maxAge: SESSION_DAYS * 86_400,
});

// ---------------- App-wide settings ----------------

export function signupOpen() {
  const r = db().prepare("SELECT value FROM settings WHERE key = 'signupOpen'").get() as { value: string } | undefined;
  return r?.value === "1";
}

export function setSignupOpen(open: boolean) {
  db().prepare("INSERT INTO settings (key, value) VALUES ('signupOpen', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(open ? "1" : "0");
}

// ---------------- Sign-in attempt limits ----------------

const attempts = new Map<string, { n: number; first: number }>();
const WINDOW = 15 * 60_000;
const MAX_FAILS = 8;

/** Minutes until this key may try again, or 0 if it can try now. */
export function lockedFor(key: string) {
  const a = attempts.get(key);
  if (!a) return 0;
  if (Date.now() - a.first > WINDOW) {
    attempts.delete(key);
    return 0;
  }
  return a.n >= MAX_FAILS ? Math.ceil((a.first + WINDOW - Date.now()) / 60_000) : 0;
}

export function noteFailure(key: string) {
  const a = attempts.get(key);
  if (!a || Date.now() - a.first > WINDOW) attempts.set(key, { n: 1, first: Date.now() });
  else a.n++;
  if (attempts.size > 5000) attempts.clear(); // bounded memory
}

export const clearFailures = (key: string) => attempts.delete(key);
